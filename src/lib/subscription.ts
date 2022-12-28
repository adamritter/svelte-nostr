const putAtEnd=true;  // Wait for EOSE to put new events in the store

import { normalizeRelayURL } from './helpers';
import type { Event, Filter, Sub } from 'nostr-tools';
import type { IEvent, QueryInfo } from './db-ievent';
import { getEventsByFilter, putEvents } from './db';
import { getFilterToRequest, type Options } from './get-filter-to-request';


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
        console.log("Writing query info", subscription.query_info)
        putEvents(subscription.filter, subscription.newEvents, undefined, subscription.query_info)
        subscription.newEvents=[]
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
export function subscribeAndCacheResults(filter: Filter, callback: (events: Event[])=>void, options:Options={}) {
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
    let db_queried_at=getTimeSec();
    
    getEventsByFilter(filter).then(({events, query_infos})=>{
        let num_events=events.length;
        console.timeLog(label, `got ${num_events} indexedDB events for filter, query_infos`, query_infos);
        if(events.length) {
            callback(events)
        }
        let filter_result=getFilterToRequest(label, filter, options, events, query_infos)
        if(filter_result) {
            let subscription:Subscription={events, callback, filter: filter_result.filter, changed: false, options,
                label, subText, newEvents: [], query_info: {db_queried_at, req_sent_at: getTimeSec(), received_events: 0,
                    last_req_sent_at: filter_result.last_req_sent_at}};
            subscriptions.set(subText, subscription)
            console.log("sending subscription REQ", subText, subscription.filter, ", original label", subscription.label,
                ", req_sent_at", subscription.query_info.req_sent_at)
            sendOnOpen(JSON.stringify(["REQ", subText, subscription.filter]));
        }
    })
    return ()=>{
            if(subscriptions.has(subText)) {
                    subscriptions.delete(subText)
                    sendOnOpen(JSON.stringify(["CLOSE", subText]));
            }
    }
}
