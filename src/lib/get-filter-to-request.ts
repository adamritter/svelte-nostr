import type { Filter, Event } from "nostr-tools";
import type { IEvent, QueryInfo } from "./db-ievent";
export type Options={
    onlyOne?: boolean,
}

const requestOnlyNewData=true;
const neverSend=false;  // Turn off data requests to the relay
const minTimeoutForSubscriptionRenewalSeconds=60*3;  // Wait at least this seconds before renewing a subscription


function filterOnlyOne(events:Event[], filter:ExtendedFilter) {
    filter={...filter}
    if(filter.ids) {
        filter.ids=filter.ids.filter((id)=>!events.find((event)=>event.id==selfOrFirst(id)))
        if(!filter.ids.length) {
            return null;
        }
    } else if(filter.authors) {
        filter.authors=filter.authors.filter((author)=>!events.find(
            (event)=>event.pubkey==selfOrFirst(author)))
        if(!filter.authors.length) {
            return null;
        }
    } else {
        throw new Error("onlyOne option not supported for this filter" + JSON.stringify(filter))
    }
    return filter
}

export function getFilterToRequest(label: string, filter: ExtendedFilter, options: Options, events:Event[],
        query_infos:(IEvent&{query_info:QueryInfo})[]) {
    if (neverSend) {
        console.timeLog(label, 'no need to send subscription because neverSend is set');
        console.timeEnd(label);
        return;
    }
    filter={...filter}
    if(options.onlyOne) {
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
    return {filter: simplifiedFilter(filter), last_req_sent_at};
}

const getTimeSec=()=>Math.floor(Date.now()/1000);


export type ExtendedFilter = {
    ids?: (string|string[])[]
    kinds?: number[]
    authors?: (string|string[])[]
    since?: number
    until?: number
    limit?: number
    [key: `#${string}`]: (string|string[])[]
  }
  let selfOrFirst=(a:string|string[])=>(typeof(a)=="string") ? a : a[0]
  export function simplifiedFilter(extended_filter: ExtendedFilter) : Filter {
    let filter: Filter = {
      ids: extended_filter.ids ? extended_filter.ids.map(selfOrFirst) : undefined,
      kinds: extended_filter.kinds,
      authors: extended_filter.authors ? extended_filter.authors.map(selfOrFirst) : undefined,
      since: extended_filter.since,
      until: extended_filter.until,
      limit: extended_filter.limit,
    }
    for (let key of Object.keys(extended_filter)) {
      if (key.startsWith("#")) {
        // @ts-ignore
        filter[key] = extended_filter[key].map(selfOrFirst)
      }
    }
    return filter
  }
  