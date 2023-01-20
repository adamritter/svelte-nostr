import type { Filter, Event } from "nostr-tools";
import { groupBy, mapValues } from "./collection-helpers";
import type { IEvent, QueryInfo } from "./db-ievent";
import { stringify } from "safe-stable-stringify";
export type Options={
    onlyOne?: boolean,
    offline?: boolean,
    dbread?: ()=>void
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
        throw new Error("onlyOne option not supported for this filter" + stringify(filter))
    }
    return filter
}
export function mergeSimilarFilters(filters: ExtendedFilter[]) : ExtendedFilter[] {
    let r=[]
    let indexByFilter=new Map<string, number>()
    for(let filter of filters) {
        let added=false;
        for(let key in filter) {
            // @ts-ignore
            if (filter[key] && (["ids", "authors", "kinds"].includes(key) || key.startsWith("#"))) {
                let new_filter={...filter}
                // @ts-ignore
                delete new_filter[key]
                let index_by=key+stringify(new_filter)
                let index=indexByFilter.get(index_by)
                if(index!==undefined) {
                    // @ts-ignore
                    let extendedFilter:ExtendedFilter=r[index]
                    // remove all other groupings for r[index]
                    for(let key2 in extendedFilter) {
                        if (key2!=key) {
                            let new_filter2={...extendedFilter}
                            // @ts-ignore
                            delete new_filter2[key2]
                            let index_by2=key2+stringify(new_filter2)
                            indexByFilter.delete(index_by2)
                        }
                    }
                    // @ts-ignore
                    r[index][key]=[...new Set(r[index][key].concat(filter[key]))]
                    added=true;
                    break;
                }
                indexByFilter.set(index_by, r.length)
            }
        }
        if(!added) {
            r.push(filter)
        }
    }
    return r
}
export function getFiltersToRequest(label: string, filters: ExtendedFilter[], options: Options, events:Event[],
        query_infos:(IEvent&{query_info:QueryInfo})[]) : (Filter & {relay?: string})[]|undefined {
    if (neverSend) {
        console.timeLog(label, 'no need to send subscription because neverSend is set');
        console.timeEnd(label);
        return;
    }
    filters=mergeSimilarFilters(filters)
    let reply_filters:(Filter & {relay?: string})[]=[]
    for(let filter of filters) {
        filter={...filter}
        let onlyOne=options.onlyOne
        if((filter.ids && filter.ids.length==0) ||
            (filter.authors && filter.authors.length==0) ||
            (filter.kinds && filter.kinds.length==0)) {
            console.timeLog(label, 'no need to send subscription because filter is empty');
            continue;
        }
        // Need to refresh sometimes own and followed profiles at least
        // (filter.authors && filter.kinds && filter.kinds.length==1 &&
        // (filter.kinds[0] == 0 || filter.kinds[0] == 3)
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
        const group_time=3600  // Group queries that have at most 1 hour difference
        
        // Split by authors
        if(filter.authors && !filter.retrieve_old) {
            let events_by_author=groupBy(events, (event)=>event.pubkey);
            let last_created_at_by_author = mapValues(events_by_author, (events)=>Math.max(...events.map((event)=>event.created_at)))
           
            let rest=[]
            let reply_filter_by_last_req_sent_at=new Map<number, Filter>()
            for(let author of filter.authors) {
                author=selfOrFirst(author)
                let last_created_at=last_created_at_by_author.get(selfOrFirst(author))
                for (let query_info_with_filter of query_infos) {
                    let query_info=query_info_with_filter.query_info;
                    if (query_info.req_sent_at && (!last_created_at || (query_info.req_sent_at > last_created_at))) {
                        if (query_info_with_filter.filter == stringify({...filter, authors:[author], limit: undefined})) {
                            last_created_at=query_info.req_sent_at;
                        }
                    }
                }
                if(last_created_at==undefined) {
                    rest.push(author)
                } else if(reply_filter_by_last_req_sent_at.get(Math.round(last_created_at/group_time))) {
                    // @ts-ignore
                    let new_filter = reply_filter_by_last_req_sent_at.get(Math.round(last_created_at/group_time))
                    if (!new_filter || !new_filter.authors) {
                        throw new Error("new_filter or authors is undefined")
                    }
                    if (new_filter.since && new_filter.since > last_created_at+1) {
                        new_filter.since=last_created_at+1;
                    }
                    new_filter.authors.push(author)
                    if (filter.limit) {
                        new_filter.limit=Math.round((new_filter.authors.length)*filter.limit/filter.authors.length)
                    }
                } else {
                    let new_filter={...filter}
                    new_filter.authors=[author]
                    new_filter.since=last_created_at+1;
                    if (new_filter.limit) {
                        new_filter.limit=Math.round(new_filter.limit/filter.authors.length)
                    }
                    let reply_filter=requestFilter(new_filter)
                    reply_filters.push(reply_filter)
                    reply_filter_by_last_req_sent_at.set(Math.round(last_created_at/group_time), reply_filter)
                }
            }
            if (rest.length == 0) {
                continue;
            }
            if (filter.limit) {
                filter.limit=Math.round(filter.limit*rest.length/filter.authors.length)
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
            // @ts-ignore
            let tags:string[]=filter[tag_key];
            let rest=[]
            let reply_filter_by_last_req_sent_at=new Map<number, Filter>()
            for(let tag of tags) {
                let tag_type=tag_key.slice(1)
                let last_created_at:number|undefined=Math.max(...events.filter(
                    (event)=>event.tags.find((etag)=>etag[0]==tag_type && etag[1]==tag)).map((event)=>event.created_at))
                if (last_created_at == -Infinity) {
                    last_created_at=undefined;
                }
                let new_filter={...filter}
                // @ts-ignore
                new_filter[tag_key]=[tag]
                new_filter.limit=undefined

                for (let query_info_with_filter of query_infos) {
                    let query_info=query_info_with_filter.query_info;
                    if (query_info.req_sent_at && (!last_created_at || (query_info.req_sent_at > last_created_at))) {
                        if (query_info_with_filter.filter == stringify(new_filter)) {
                            last_created_at=query_info.req_sent_at;
                        }
                    }
                }

                if(last_created_at==undefined) {
                    rest.push(tag)
                } else if(reply_filter_by_last_req_sent_at.get(Math.round(last_created_at/group_time))) {
                    // @ts-ignore
                    let new_filter = reply_filter_by_last_req_sent_at.get(Math.round(last_created_at/group_time))
                    // @ts-ignore
                    if (!new_filter || !new_filter[tag_key]) {
                        throw new Error("new_filter or authors is undefined")
                    }
                    if (new_filter.since && new_filter.since > last_created_at+1) {
                        new_filter.since=last_created_at+1;
                    }
                    // @ts-ignore
                    new_filter[tag_key].push(tag)
                    if (filter.limit) {
                        // @ts-ignore
                        new_filter.limit=Math.round((new_filter[tag_key].length)*filter.limit/filter[tag_key].length)
                    }
                } else {
                    let new_filter={...filter}
                    // @ts-ignore
                    new_filter[tag_key]=[tag]
                    new_filter.since=last_created_at+1;
                    let reply_filter = requestFilter(new_filter)
                    reply_filters.push(reply_filter)
                    reply_filter_by_last_req_sent_at.set(Math.round(last_created_at/group_time), reply_filter)
                }
            }
            if (rest.length == 0) {
                skip_final=true;
                break;
            }
            if (filter.limit) {
                // @ts-ignore
                filter.limit=Math.round(filter.limit*rest.length/filter[tag_key].length)
            }
            // @ts-ignore
            filter[tag_key]=rest;
            
        }
        if (!skip_final) {
            reply_filters.push(requestFilter(filter))
        }
    }
    if(reply_filters.length==0) {
        return;
    }
    return reply_filters
}

const getTimeSec=()=>Math.floor(Date.now()/1000);


export type ExtendedFilter = {
    ids?: string[]
    kinds?: number[]
    authors?: string[]
    since?: number
    until?: number
    limit?: number
    [key: `#${string}`]: (string|string[])[],
    // For each author / other key, get old data as well, don't look at events in the db for setting ,,since'' in filter.
    // It's not recommended to use this, as looking at query times is efficeint.
    retrieve_old?: boolean 
    relay?: string  // relay to use for requesting data. Must be sent to the relaypool, but not to db.
    // filter key to use for storing data. Used for storing event a post replied to, for example
    // [{authors:["1234..."]}] even if the pubkey is different.
    store_filter?: string  
  }
  let selfOrFirst=(a:string|string[])=>(typeof(a)=="string") ? a : a[0]
  export function requestFilter(extended_filter: ExtendedFilter) : (Filter & {relay?: string}) {
    let filter: Filter & {relay?: string} = {};
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

    if (extended_filter.relay) {
        filter.relay = extended_filter.relay
    }
    
    for (let key of Object.keys(extended_filter)) {
      if (key.startsWith("#")) {
        // @ts-ignore
        filter[key] = extended_filter[key].map(selfOrFirst)
      }
    }
    return filter
  }

  export function dbSimplifiedFilter(extended_filter : ExtendedFilter) : Filter {
    let filter=requestFilter(extended_filter)
    delete filter.relay
    return filter
}
  