const putAtEnd=true;  // Wait for EOSE to put new events in the store

import { normalizeRelayURL } from './helpers';
import type {Event, Filter} from 'nostr-tools'
import {type Relay, type Sub, relayInit } from './relay';
import type { QueryInfo } from './db-ievent';
import { getEventsByFilter, putEvents } from './db';
import { getFilterToRequest, type Options, type ExtendedFilter, simplifiedFilter } from './get-filter-to-request';


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
    sub?: Sub,
}

let subscriptionId=0;

// Registry: https://nostr-registry.netlify.app/
let relays = "wss://nostr-relay.wlvs.space";
relays = "wss://relay.damus.io"
relays = "wss://nostr.fmt.wiz.biz"
relays = normalizeRelayURL( relays );
const relay:Relay = relayInit(relays)

function containsId(events:Event[], id:string) {
    for(let event of events) {
        if(event.id == id) {
            return true;
        }
    }
    return false;
}

let unsubscribe=(subscription:Subscription) => {
    subscription.sub?.unsub();
    subscription.sub=undefined;
}

function eoseReceived(subscription:Subscription) {
    subscription.query_info.eose_received_at=getTimeSec()
    subscription.query_info.total_events=subscription.events.length
    subscription.query_info.new_events=subscription.newEvents.length

    console.timeLog(subscription.label, "EOSE with "+subscription.events.length+
        " events, from that "+subscription.newEvents.length+" new");
    console.timeEnd(subscription.label);
    console.log("Writing query info", subscription.query_info)
    putEvents(subscription.filter, subscription.newEvents, undefined, subscription.query_info)
    subscription.newEvents=[]
    if(subscription.changed && subscription.callback) {
        subscription.callback(subscription.events);
    }
    subscription.eose=true;

    if(subscription.autoClose) {
        unsubscribe(subscription)
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
};

function eventReceived(subscription:Subscription, event:Event & {id:string}) {
    subscription.query_info.received_events++;
    if(!containsId(subscription.events, event.id)) {
        newEventReceived(subscription, event)
    }
};

relay.on('disconnect', () => {
    console.log("relay disconnected")
});

relay.connect();
function subscribe(subscription:Subscription) {
    console.log("relay.sub", subscription.subText,  subscription.filter)
    let sub=relay.sub([subscription.filter])
    subscription.sub=sub
    sub.on('event', (event: Event & {id: string}) => {
        console.log("event", subscription.subText, event)
        eventReceived(subscription, event)
    })
    sub.on('eose', () => eoseReceived(subscription))
}

const getTimeSec=()=>Math.floor(Date.now()/1000);
const matchImpossible=(filter:ExtendedFilter)=>(filter.ids && filter.ids.length == 0) || (filter.authors && filter.authors.length == 0);

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
export function subscribeAndCacheResults(filter: ExtendedFilter, callback: (events: Event[])=>void, options:Options={}) {
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
    let subscription:Subscription|undefined;
    
    getEventsByFilter(simplifiedFilter(filter)).then(({events, query_infos})=>{
        let num_events=events.length;
        console.timeLog(label, `got ${num_events} indexedDB events for filter, query_infos`, query_infos);
        if(events.length) {
            callback(events)
        }
        let filter_result=getFilterToRequest(label, filter, options, events, query_infos)
        if(filter_result) {
            subscription={events, callback, filter: filter_result.filter, changed: false, options,
                label, subText, newEvents: [], query_info: {db_queried_at, req_sent_at: getTimeSec(), received_events: 0,
                    last_req_sent_at: filter_result.last_req_sent_at}};
            console.log("sending subscription REQ", subText, subscription.filter, ", original label", subscription.label,
                ", req_sent_at", subscription.query_info.req_sent_at)
            subscribe(subscription)
        }
    })
    return ()=>{
            if(subscription) {
                unsubscribe(subscription)
                subscription.callback=null;
            }
    }
}
