const putAtEnd=true;  // Wait for EOSE to put new events in the store

import type {Event, Filter} from 'nostr-tools'
import type { QueryInfo } from './db-ievent';
import { getEventsByFilters, putEvents } from './db';
import { getFiltersToRequest, type Options, type ExtendedFilter, simplifiedFilter } from './get-filters-to-request';
import { RelayPool, RelayPoolSubscription } from 'nostr-relaypool'
import { stringify } from "safe-stable-stringify";

type Subscription={
    events: Event[],
    storedEvents: Event[],
    callback:any,
    filters:Filter[],
    changed: boolean,
    options:Options,
    label:string,
    subText:string,
    newEvents: Event[],
    query_info: QueryInfo,
    eose?: boolean,
    autoClose?: boolean,
    sub?: RelayPoolSubscription,
}

let subscriptionId=0;


// var BOOTSTRAP_RELAYS = [
//     "wss://relay.damus.io",
//     "wss://nostr-relay.wlvs.space",
//     "wss://nostr.fmt.wiz.biz",
//     "wss://nostr.oxtr.dev",
// ]

// Registry: https://nostr-registry.netlify.app/
export let allRelays=[
    "wss://nostr.mom",
    "wss://nostr.cercatrova.me",
    "wss://nostr.ono.re",
    "wss://relay.nostr.info",
    "wss://nostr-relay.wlvs.space",
    "wss://nostr-relay.freeberty.net",
    "wss://relay.minds.com/nostr/v1/ws",
    "wss://nostr-pub.semisol.dev",
    "wss://jiggytom.ddns.net",
    "wss://relay.stoner.com",
    "wss://nostr.f44.dev",
    "wss://nostr.semisol.dev",
    "wss://nostr-verified.wellorder.net",
    "wss://nostr.coollamer.com",
    "wss://nostr.yael.at",
    "wss://relay.grunch.dev",
    "wss://nostr.bitcoiner.social",
    "wss://nostr.sandwich.farm",
    "wss://nostr.slothy.win",
    "wss://nostr.unknown.place",
    "wss://nostr.fmt.wiz.biz",
    "wss://nostr.zebedee.cloud",
    "wss://freedom-relay.herokuapp.com/ws",
    "wss://nostr-pub.wellorder.net",
    "wss://nostr.mado.io",
    "wss://nostr.einundzwanzig.space",
    "wss://nostr.openchain.fr",
    "wss://nostr-relay.digitalmob.ro",
    "wss://nostr.rocks",
    "wss://nostr.nymsrelay.com",
    "wss://nostr.walletofsatoshi.com",
    "wss://nostr-relay.untethr.me",
    "wss://relay.cynsar.foundation",
    "wss://nostr-2.zebedee.cloud",
    "wss://nostr.zaprite.io",
    "wss://relay.nostr.ch",
    "wss://nostr.delo.software",
    "wss://nostr.nodeofsven.com",
    "wss://nostr.oxtr.dev",
    "wss://nostr.drss.io",
    "ws://jgqaglhautb4k6e6i2g34jakxiemqp6z4wynlirltuukgkft2xuglmqd.onion",
    "wss://nostr-relay.nonce.academy",
    "wss://nostr.orangepill.dev",
    "wss://rsslay.fiatjaf.com",
    "wss://nostr.onsats.org",
    "wss://relayer.fiatjaf.com",
    "wss://relay.damus.io",
    "wss://nostr.bongbong.com",
]
// let relays = "wss://nostr-relay.wlvs.space";
// relays = "wss://relay.damus.io"
// relays = "wss://nostr.fmt.wiz.biz"
// relays = "wss://nostr.slothy.win"
// relays ="wss://nostr.bongbong.com",  // fast
// relays = "wss://relay.damus.io"
// relays = "wss://nostr.fmt.wiz.biz"
export let relays=[
    "wss://relay.damus.io",
    "wss://nostr.fmt.wiz.biz",
    "wss://nostr.bongbong.com",
    "wss://nostr-2.zebedee.cloud",
    "wss://nostr.zaprite.io",
    "wss://relay.nostr.ch",
    "wss://nostr.delo.software",
    "wss://nostr.nodeofsven.com",
    "wss://nostr.oxtr.dev",
    "wss://nostr-relay.wlvs.space",
    "wss://nostr-pub.wellorder.net",
   ]
const relayPool = new RelayPool([])
relayPool.onerror = (err) => {
    console.log("RelayPool error", err);
}
relayPool.onnotice((notice) => {
    console.log("RelayPool notice", notice);
})

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

function eoseReceived(subscription:Subscription, events: (Event& {id: string})[] ) {
    subscription.query_info.eose_received_at=getTimeSec()
    subscription.query_info.total_events=subscription.events.length
    subscription.query_info.new_events=events.length; // subscription.newEvents.length
    let newEvents=events.filter((event) => !containsId(subscription.storedEvents, event.id))
    

    console.timeLog(subscription.label, "EOSE with "+events.length+
        " events, from that "+newEvents.length+" not stored yet, total events seen: ", subscription.events.length,
        ", total events stored: ", subscription.storedEvents.length, ", query_info: ", subscription.query_info);
    console.log("Writing query info", subscription.query_info)
    putEvents(subscription.filters, newEvents, undefined, subscription.query_info)
    subscription.storedEvents = subscription.storedEvents.concat(newEvents)
    if(subscription.changed && subscription.callback) {
        subscription.callback(subscription.events);
    }
    // subscription.eose=true;

    // if(subscription.autoClose) {
        // unsubscribe(subscription)
    // }
}

function newEventReceived(subscription:Subscription, event:Event & {id:string}, afterEose: boolean) {
    subscription.changed=true;
    subscription.events.push(event)
    let storeEvent=false;
    if (afterEose) {
        storeEvent=true;
        
        // console.time("callback")
        subscription.callback(subscription.events);
        // console.timeEnd("callback")
    } else {
        if(!putAtEnd) {
             storeEvent=true;
        } else {
            subscription.newEvents.push(event)
        }
    }
    if(storeEvent) {
        if (!containsId(subscription.storedEvents, event.id)) {
            putEvents(subscription.filters, [event])
            subscription.storedEvents.push(event)
        }
    }
};

function eventReceived(subscription:Subscription, event:Event & {id:string}, afterEose: boolean) {
    subscription.query_info.received_events++;
    if(!containsId(subscription.events, event.id)) {
        newEventReceived(subscription, event, afterEose)
    }
};
relayPool.ondisconnect((msg: string) => {
    console.log("relay disconnected", msg)
});


function subscribe(subscription:Subscription) {
    console.log("relay.sub", subscription.subText,  ...subscription.filters)
    let sub=relayPool.sub(subscription.filters, relays)
    subscription.sub=sub

    sub.onevent((event: Event & {id: string}, afterEose: boolean) => {
        eventReceived(subscription, event, afterEose)
    })
    sub.oneose((events, url) => {
        console.log("eose received at", url)
        if(events) {
            eoseReceived(subscription, events)
        } else {
            console.warn("eose received without events (server sent eose twice")
        }
    })
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
export function subscribeAndCacheResults(filters: ExtendedFilter[], callback: (events: Event[])=>void, options:Options={}) {
    let label=stringify(filters);
    console.time(label);
    let subText="sub"+subscriptionId
    subscriptionId=subscriptionId+1
    let db_queried_at=getTimeSec();
    let subscription:Subscription|undefined;
    
    getEventsByFilters(filters.map(simplifiedFilter)).then(({events, query_infos})=>{
        let num_events=events.length;
        if(events.length) {
            callback(events)
        }
        if(options.offline) {
            console.timeLog(label, "offline mode, no subscription", events, query_infos);
            console.timeEnd();
            return;
        }
        let filter_result=getFiltersToRequest(label, filters, options, events, query_infos)
        console.timeLog(label, `got ${num_events} indexedDB events for filter, query_infos`, query_infos,
            "filter_result", filter_result);
        if(filter_result) {
            subscription={events, callback, filters: filter_result, changed: false, options,
                label, subText, newEvents: [], storedEvents: events,
                query_info: {db_queried_at, req_sent_at: getTimeSec(), received_events: 0}};
            console.log("sending subscription REQ", subText, ...subscription.filters, ", original label", subscription.label,
                ", req_sent_at", subscription.query_info.req_sent_at)
            subscribe(subscription)
        }
    })
    return ()=>{
            if(subscription) {
                console.timeEnd(subscription.label)
                unsubscribe(subscription)
                subscription.callback=null;
            }
    }
}

export function subdebug(filters: Filter[], relays: string[]) {
    let sub = relayPool.sub(filters, relays)
    let time=Date.now()
    sub.oneose((events, url)=>{
        console.log("subdebug", url, Date.now()-time, "ms",  filters, events)
    })
}