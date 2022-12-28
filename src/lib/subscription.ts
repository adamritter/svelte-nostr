const putAtEnd=true;  // Wait for EOSE to put new events in the store
const neverSend=false;  // Turn off data requests to the relay
const requestOnlyNewData=true;
const minTimeoutForSubscriptionRenewalSeconds=60*3;  // Wait at least this seconds before renewing a subscription

import Dexie from 'dexie';
import { normalizeRelayURL } from './helpers';
import { getEventsToPut } from './db-events-to-put';
import type { Event, Filter, Sub } from 'nostr-tools';
import type { IEvent, QueryInfo } from './db-ievent';


export class EventsDB extends Dexie {
    events!: Dexie.Table<IEvent>;
    
    constructor() {  
      super("nostr_events", {chromeTransactionDurability: "relaxed"});
      
      this.version(1).stores({
        events: "++,filter"
});
    }
  }
  

  
export let db=new EventsDB();

function splitWhereCaluseBy(filter:Filter, key:"authors"|"ids"|"#p"|"#e"|null) : Dexie.Collection<IEvent, number> | null {
    if (key) {
        // @ts-ignore
        if(filter[key] && filter[key].length > 1) {
            return db.events.where("filter").anyOf(
                // @ts-ignore
                filter[key].map(p => JSON.stringify({...filter, [key]: [p]})));
        } else {
            return null;
        }
    } else {
        return db.events.where("filter").equals(JSON.stringify(filter));
    }
}

function splitWhereClause(filter: Filter) : Dexie.Collection<IEvent, number> {
    let r = splitWhereCaluseBy(filter, "authors") ||
        splitWhereCaluseBy(filter, "ids") ||
        splitWhereCaluseBy(filter, "#p") ||
        splitWhereCaluseBy(filter, "#e") ||
        splitWhereCaluseBy(filter, null);
    if (!r) {
        throw new Error("splitWhereClause bug")
    }
    return r;
}

// Exported only for debugging
export function getEventsByFilter(filter: Filter): Promise<{events: Event[], query_infos: (IEvent&{query_info:QueryInfo})[] }> {
    filter={...filter}
    delete filter.limit
    let filtered=splitWhereClause(filter);
    return filtered.toArray()
            .then(events => {
                    let flat_events=events.map(event => (event.events ||event.event || [])).flat()
                    // @ts-ignore
                    let query_infos: (IEvent&{query_info:QueryInfo})[]=events.filter(event => event.query_info)
                    return {events: flat_events, query_infos};
            });
}

function putEvents(filter: Filter, events: Event[], batchSize:number=30, query_info:QueryInfo|null=null) {
    let toPutArray=getEventsToPut(filter, events, batchSize, query_info);
    return db.events.bulkPut(toPutArray)
}


type Options={
    onlyOne?: boolean,
}

type Subscription={
    events: Event[],
    callback:any,
    filter:Filter,
    changed: boolean,
    options:Options,
    label:string,
    subText:string,
    newEvents: Event[],
    query_info: QueryInfo,
    eose?: boolean,
    autoClose?: boolean,
}

let subscriptions:Map<string,Subscription>=new Map();
let subscriptionId=0;

// Registry: https://nostr-registry.netlify.app/
let relay = "wss://nostr-relay.wlvs.space";
relay = "wss://relay.damus.io"
relay = "wss://nostr.fmt.wiz.biz"
relay = normalizeRelayURL( relay );
export let socket = new WebSocket( relay );

function containsId(events:Event[], id:string) {
    for(let event of events) {
        if(event.id == id) {
            return true;
        }
    }
    return false;
}

function eoseReceived(subText:string) {
    let subscription=subscriptions.get(subText)
    if(subscription) {
        subscription.query_info.eose_received_at=getTimeSec()
        subscription.query_info.total_events=subscription.events.length
        subscription.query_info.new_events=subscription.newEvents.length

        console.timeLog(subscription.label, "EOSE with "+subscription.events.length+
            " events, from that "+subscription.newEvents.length+" new");
        console.timeEnd(subscription.label);
        // Write query info even if there are no new events.
        // if(subscription.newEvents.length > 0) {
            console.log("Writing query info", subscription.query_info)
            putEvents(subscription.filter, subscription.newEvents, undefined, subscription.query_info)
            subscription.newEvents=[]
        // }
        if(subscription.changed) {
            subscription.callback(subscription.events);
        }
        subscription.eose=true;
    }
    
    if(!subscription || subscription.autoClose) {
        socket.send(JSON.stringify(["CLOSE", subText]))
        subscriptions.delete(subText)
    }
}

function newEventReceived(subscription:Subscription, event:Event) {
    subscription.changed=true;
    subscription.events.push(event)
    
    if (subscription.eose) {
        putEvents(subscription.filter, [event])
        console.time("callback")
        subscription.callback(subscription.events);
        console.timeEnd("callback")
    } else {
        if(!putAtEnd) {
            putEvents(subscription.filter, [event])
        } else {
            subscription.newEvents.push(event)
        }
    }
}

function eventReceived(subText:string, event:Event & {id:string}) {
    let subscription=subscriptions.get(subText)
    if(subscription) {
        subscription.query_info.received_events++;
        if(!containsId(subscription.events, event.id)) {
            newEventReceived(subscription, event)
        }
    }
}

socket.addEventListener('message', function( message ) {
    console.log("got message", message)
        var event = JSON.parse( message.data );
        // showEvent(event);
        if(event[0]=="EVENT") {
            eventReceived(event[1], event[2])
        } else if (event[0]=="EOSE") {
            eoseReceived(event[1])
        }
});
let send_on_open:string[]=[]
socket.addEventListener('open', function() {
        for(let i=0; i<send_on_open.length; i++) {
                socket.send(send_on_open[i])
        }
        send_on_open.length=0
});

function sendOnOpen(data:string) {
        if(socket.readyState==1) {
                socket.send(data)
        } else {
                send_on_open.push(data)
        }
}
const getTimeSec=()=>Math.floor(Date.now()/1000);
const matchImpossible=(filter:Filter)=>(filter.ids && filter.ids.length == 0) || (filter.authors && filter.authors.length == 0);

function filterOnlyOne(events:Event[], filter:Filter) {
    filter={...filter}
    if(filter.ids) {
        filter.ids=filter.ids.filter((id)=>!events.find((event)=>event.id==id))
        if(!filter.ids.length) {
            return null;
        }
    } else if(filter.authors) {
        filter.authors=filter.authors.filter((author)=>!events.find((event)=>event.pubkey==author))
        if(!filter.authors.length) {
            return null;
        }
    } else {
        throw new Error("onlyOne option not supported for this filter" + JSON.stringify(filter))
    }
    return filter
}

function getFilterToRequest(subscription: Subscription, events:Event[], query_infos:(IEvent&{query_info:QueryInfo})[]) {
    let label=subscription.label;
    if (neverSend) {
        console.timeLog(label, 'no need to send subscription because neverSend is set');
        console.timeEnd(label);
        return;
    }
    let filter={...subscription.filter}
    if(subscription.options.onlyOne) {
        let filterOptional=filterOnlyOne(events, filter)
        if(!filterOptional) {
            console.timeLog(label, 'no need to send subscription because all events are already in the database');
            console.timeEnd(label);
            return;
        }
        filter=filterOptional
    }
    // This is the point where we can optimize the requests by setting query time limits.
    // Also if there are different last query times for different subfilters, we need to send multiple requests.
    // Those multiple requests should probably still shared the same event stream, just like having multiple relays.
    // We need to differentiate between client subscriptions and server subscriptions.
    // One client subscription can have multiple server subscriptions.
    let last_req_sent_at=query_infos.map((query_info)=>query_info.query_info.req_sent_at).sort().pop()
    if(last_req_sent_at!=undefined) {
        let timePassed=getTimeSec()-last_req_sent_at;
    console.log("last_req_sent_at", last_req_sent_at, "timePassed sec", timePassed)
        if (timePassed < minTimeoutForSubscriptionRenewalSeconds) {
            console.timeLog(label, 'not enough time passed, not sending subscription');
            console.timeEnd(label);
            return;
        }
        if(requestOnlyNewData) {
            filter.since=last_req_sent_at-60*6;
        }
    }
    return {filter, last_req_sent_at};
    
}

/**
 put queried at, max timestamp, min timestamp (min timestamp is 0 if there was no limit reached) in database
 Big: support for multiple relays (logging queries can help)
 message verification: should it use nostr-tools library?

 Returns unsubscribe function, calls back with array of events.
 It may call back multiple times (first from cached results, then updated results)
 It stores results in indexedDB and returns with cached results first if there is match.
 options:
  onlyOne: return only one result
  autoClose: close subscription after first result
 */
export function subscribeAndCacheResults(filter: Filter, callback: ()=>any, options:Options={}) {
    if (filter.ids) {
        options.onlyOne=true;
    }
    let label=JSON.stringify(filter);
    console.time(label);
    if(matchImpossible(filter)) {
        return ()=>{}
    }
    let subText="sub"+subscriptionId
    subscriptionId=subscriptionId+1
    subscriptions.set(subText, {events: [], callback, filter, changed: false, options,
            label, subText, newEvents: [], query_info: {db_queried_at: getTimeSec(), received_events: 0}})
    
    getEventsByFilter(filter).then(({events, query_infos})=>{
            let num_events=events.length;
            console.timeLog(label, `got ${num_events} indexedDB events for filter, query_infos`, query_infos);
            let subscription=subscriptions.get(subText)
            if(subscription) {
                if(events.length) {
                    subscription.events=events;
                    subscription.callback(events)
                }
                let filter_result=getFilterToRequest(subscription, events, query_infos)
                if(filter_result) {
                    subscription.query_info.last_req_sent_at=filter_result.last_req_sent_at;
                    subscription.filter=filter_result.filter;
                    subscription.query_info.req_sent_at=getTimeSec();
                    subscription.query_info.received_events=0;
                    console.log("sending subscription REQ", subText, subscription.filter, ", original label", subscription.label,
                        ", req_sent_at", subscription.query_info.req_sent_at)
                    sendOnOpen(JSON.stringify(["REQ", subText, subscription.filter]));
                }
            }
    })
    return ()=>{
            if(subscriptions.has(subText)) {
                    subscriptions.delete(subText)
                    sendOnOpen(JSON.stringify(["CLOSE", subText]));
            }
    }
}
