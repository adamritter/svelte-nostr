
import Dexie from 'dexie';
import { getEventsToPut } from './db-events-to-put';
import type { Event, Filter } from 'nostr-tools';
import type { IEvent, QueryInfo } from './db-ievent';
import type { WhereClause } from 'dexie';
import { stringify } from "safe-stable-stringify";
import { dbSimplifiedFilter, type ExtendedFilter } from './get-filters-to-request';


export class EventsDB extends Dexie {
    events!: Dexie.Table<IEvent>;
    constructor() {  
        super("nostr_events", {chromeTransactionDurability: "relaxed"});
        this.version(1).stores({
            events: "++,filter"
        });
    }
  }
  
export const db=new EventsDB();

function splitFilterBy(filter:Filter, key:"authors"|"ids"|"#p"|"#e"|null) : string[] | null {
    if (key) {
        // @ts-ignore
        if(filter[key] && filter[key].length > 1) {
                // @ts-ignore
                return filter[key].map(p => stringify({...filter, [key]: [p]}));
        } else {
            return null;
        }
    } else {
        return [stringify(filter)];
    }
    return null;
}

function splitFilter(filter: Filter) : string[] {
    let r = splitFilterBy(filter, "authors") ||
    splitFilterBy(filter, "ids") ||
    splitFilterBy(filter, "#p") ||
    splitFilterBy(filter, "#e") ||
    splitFilterBy(filter, null);
    if (!r) {
        throw new Error("splitWhereClause bug")
    }
    return r;
}

function filterKeysFor(filter: ExtendedFilter) : string[] {
    if(filter.store_filter) {
        return [stringify(filter.store_filter)];
    } else {
        return splitFilter(dbSimplifiedFilter(filter));
    }
}

export function putEvents(filters: (Filter&{relay?: string})[], events: (Event&{id:string})[], batchSize:number=30, query_info:QueryInfo|null=null) {
    console.log("putEvents called with ", events.length, " events")
    let toPutArray=getEventsToPut(filters, events, batchSize, query_info);
    return db.events.bulkPut(toPutArray)
}

export function clearAllEvents() {
    return db.events.clear();
}

export function getEventsByFilters(filters: ExtendedFilter[]):
        Promise<{events: Event[], query_infos: (IEvent&{query_info:QueryInfo})[] }> {
    let keys: string[][]=[]
    for(let filter of filters) {
        filter={...filter}
        delete filter.limit
        delete filter.since
        delete filter.until
        delete filter.relay
        delete filter.retrieve_old
        console.log("filter keys for ",filter,  filterKeysFor(filter))
        keys.push(filterKeysFor(filter))
    }
    let filtered=db.events.where("filter").anyOf(keys.flat())
    return filtered.toArray()
            .then(events => {
                    let flat_events=events.map(event => (event.events ||event.event || [])).flat()
                    // @ts-ignore
                    let query_infos: (IEvent&{query_info:QueryInfo})[]=events.filter(event => event.query_info)
                    return {events: flat_events, query_infos};
            });
            
}