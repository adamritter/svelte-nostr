import type { Event, Filter } from "nostr-tools";
import type { IEvent, QueryInfo } from "./db-ievent";

/**
 * After getting back events from the server, we need to split them up
 by ids / authors / tags to be able to retreive them later.
 The function also does batching of events, as it is much more
 efficient to retrieve them later.
 Another thing the function does is writing query information so that
 after retrieval we can know if we can send requests to various relays,
 and select the relays to send the requests to.
 * @param {*} filter filter to split to multiple filters
 * @param {*} events 
 * @param {*} batchSize 
 * @param {*} query_info 
 * @returns 
 */
 export function getEventsToPut(filters:Filter[], events: Event[], batchSize:number=30, query_info:QueryInfo|null=null) : IEvent[] {
    let toPutArray:IEvent[]=[];
    for(let filter of filters) {
        filter={...filter}
        delete filter.limit
        delete filter.since;
        delete filter.until;
        let toPut:Map<string,Event[]> = new Map();
        // Needed filter splitting for writing query_info for empty filter results as well.
        for(let f of splitFilter(filter)) {
            toPut.set(JSON.stringify(f), []);
        }
        for (let event of events) {
            splitAndAddToPut(toPut, filter, event)
        }
        for(let [filter, events] of toPut) {
            addBatchedQueries(toPutArray, filter, events, batchSize, query_info);
        }
    }
    return toPutArray;
}

function addToPutBy(toPut:Map<string, Array<Event>>, filter:Filter, key:"authors"|"ids"|"#p"|"#e"|null, event:Event,
        eventKey:string|null=null, isTag=false) {
    if(key) {
        // @ts-ignore
        if(filter[key] && filter[key].length > 1) { 
            // @ts-ignore
            for(let value of filter[key]) {
                if(isTag) {
                    for(let tag of event.tags) {
                        if(tag[0] == eventKey) {
                            if(tag[1] === value) {
                                addToPut(toPut, {...filter, [key]: [value]}, event);
                                break;
                            }
                        }
                    }
                // @ts-ignore
                } else if(eventKey != null && event[eventKey] === value) {
                    addToPut(toPut, {...filter, [key]: [value]}, event);
                    break;
                }
            }
            return true;
        }
        return false;
    } else {
        addToPut(toPut, filter, event);
    }
}

function addToPut(toPut:Map<string, Array<Event>>, filter:Filter, event:Event) {
    let jsonFilter=JSON.stringify(filter)
    let events=toPut.get(jsonFilter);
    if(events) {
        events.push(event);
    } else {
        toPut.set(jsonFilter, [event]);
    }
}

function splitAndAddToPut(toPut:Map<string, Array<Event>>, filter:Filter, event:Event) {
    addToPutBy(toPut, filter, "authors", event, "pubkey", false) ||
     addToPutBy(toPut, filter, "ids", event, "ids", false) ||
     addToPutBy(toPut, filter, "#p", event, "p", true) ||
     addToPutBy(toPut, filter, "#e", event, "e", true) ||
     addToPutBy(toPut, filter, null, event);
}

function addBatchedQueries(toPutArray: IEvent[], filter:string, events:Event[], batchSize:number, query_info:QueryInfo|null) {
    events=events.sort((a,b) => a.created_at - b.created_at);
    for(let i=0; i<events.length; i+=batchSize) {
        if(batchSize > 1 || events.length==1) {
            toPutArray.push({
                filter: filter,
                events: events.slice(i, i+batchSize)
            })
        } else {
            toPutArray.push({
                filter: filter,
                event: events[i]
            })
        }
    }
    if(query_info) {
        toPutArray.push({
            filter: filter,
            query_info
        })
    }
}

function splitFilter(filter:Filter) : Filter[] {
    let filters=[]
    if(filter.authors && filter.authors.length > 1) {
        for(let author of filter.authors) {
            filters.push({...filter, authors: [author]})
        }
    } else if(filter.ids && filter.ids.length > 1) {
        for(let id of filter.ids) {
            filters.push({...filter, ids: [id]})
        }
    } else if(filter["#p"] && filter["#p"].length > 1) {
        for(let p of filter["#p"]) {
            filters.push({...filter, "#p": [p]})
        }
    } else if(filter["#e"] && filter["#e"].length > 1) {
        for(let e of filter["#e"]) {
            filters.push({...filter, "#e": [e]})
        }
    } else {
        filters.push(filter)
    }
    return filters;
}
