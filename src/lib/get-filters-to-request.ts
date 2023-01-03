import type { Filter, Event } from "nostr-tools";
import { groupBy, mapValues } from "./collection-helpers";
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
export function getFiltersToRequest(label: string, filters: ExtendedFilter[], options: Options, events:Event[],
        query_infos:(IEvent&{query_info:QueryInfo})[]) : Filter[]|undefined {
    if (neverSend) {
        console.timeLog(label, 'no need to send subscription because neverSend is set');
        console.timeEnd(label);
        return;
    }
    let reply_filters:Filter[]=[]
    for(let filter of filters) {
        filter={...filter}
        let onlyOne=options.onlyOne
        if((filter.ids && filter.ids.length==0) ||
            (filter.authors && filter.authors.length==0) ||
            (filter.kinds && filter.kinds.length==0)) {
            console.timeLog(label, 'no need to send subscription because filter is empty');
            continue;
        }
        if(filter.ids) {
            onlyOne=true;
        }
        if(onlyOne) {
            let filterOptional=filterOnlyOne(events, filter)
            if(!filterOptional) {
                console.timeLog(label, 'no need to send subscription because all events are already in the database');
                continue;
            }
            filter=filterOptional
        }
        
        // Split by authors
        if(filter.authors && !filter.retrieve_old) {
            console.log("splitting by authors", filter.authors)
            console.log("events", events)
            let events_by_author=groupBy(events, (event)=>event.pubkey);
            let last_created_at_by_author = mapValues(events_by_author, (events)=>Math.max(...events.map((event)=>event.created_at)))
            console.log("last_created_at_by_author", last_created_at_by_author)
            let rest=[]
            for(let author of filter.authors) {
                let last_created_at=last_created_at_by_author.get(selfOrFirst(author))
                if(last_created_at==undefined) {
                    rest.push(author)
                } else {
                    let new_filter={...filter}
                    new_filter.authors=[author]
                    new_filter.since=last_created_at+1;
                    reply_filters.push(simplifiedFilter(new_filter))
                }
            }
            if (rest.length == 0) {
                continue;
            }
            filter.authors=rest;
        }
        // Split by tags
        //Get tags from filter 
        let skip_final=false;
        for(let tag_key of Object.keys(filter)) {
            if (!tag_key.startsWith("#")) {
                continue;
            }
            console.log("Splitting by tag", tag_key, filter[tag_key]);
            let rest=[]
            for(let tag of filter[tag_key]) {
                let tag_type=tag_key.slice(1)
                let last_created_at=Math.max(...events.filter(
                    (event)=>event.tags.find((etag)=>etag[0]==tag_type && etag[1]==tag)).map((event)=>event.created_at))
                console.log("last_created_at", last_created_at, tag_type, tag)
                if(last_created_at==undefined) {
                    rest.push(tag)
                } else {
                    let new_filter={...filter}
                    new_filter[tag_key]=[tag]
                    new_filter.since=last_created_at+1;
                    reply_filters.push(simplifiedFilter(new_filter))
                }
            }
            if (rest.length == 0) {
                skip_final=true;
                break;
            }
            filter[tag_key]=rest;
        }
        if (!skip_final) {
            reply_filters.push(simplifiedFilter(filter))
        }
    }
    if(reply_filters.length==0) {
        return;
    }
    return reply_filters
}

const getTimeSec=()=>Math.floor(Date.now()/1000);


export type ExtendedFilter = {
    ids?: (string|string[])[]
    kinds?: number[]
    authors?: (string|string[])[]
    since?: number
    until?: number
    limit?: number
    [key: `#${string}`]: (string|string[])[],
    retrieve_old?: boolean  // For each author / other key, get old data as well, don't look at events in the db.
  }
  let selfOrFirst=(a:string|string[])=>(typeof(a)=="string") ? a : a[0]
  export function simplifiedFilter(extended_filter: ExtendedFilter) : Filter {
    let filter: Filter = {};
    if (extended_filter.ids) {
        filter.ids = extended_filter.ids.map(selfOrFirst)
    }
    if (extended_filter.kinds) {
        filter.kinds = extended_filter.kinds
    }
    if (extended_filter.authors) {
        filter.authors = extended_filter.authors.map(selfOrFirst)
    }
    if (extended_filter.since) {
        filter.since = extended_filter.since
    }
    if (extended_filter.until) {
        filter.until = extended_filter.until
    }
    if (extended_filter.limit) {
        filter.limit = extended_filter.limit
    }
    
    for (let key of Object.keys(extended_filter)) {
      if (key.startsWith("#")) {
        // @ts-ignore
        filter[key] = extended_filter[key].map(selfOrFirst)
      }
    }
    return filter
  }
  