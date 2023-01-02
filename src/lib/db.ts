
import Dexie from 'dexie';
import { getEventsToPut } from './db-events-to-put';
import type { Event, Filter } from 'nostr-tools';
import type { IEvent, QueryInfo } from './db-ievent';
import type { WhereClause } from 'dexie';

export class EventsDB extends Dexie {
    events!: Dexie.Table<IEvent>;
    constructor() {  
        super("nostr_events", {chromeTransactionDurability: "relaxed"});
        this.version(1).stores({
            events: "++,filter"
        });
    }
  }
  
const db=new EventsDB();

function splitWhereCaluseBy(filter:Filter, key:"authors"|"ids"|"#p"|"#e"|null,
        whereClause:WhereClause<IEvent,any>) : Dexie.Collection<IEvent, number> | null {
    if (key) {
        // @ts-ignore
        if(filter[key] && filter[key].length > 1) {
            return whereClause.anyOf(
                // @ts-ignore
                filter[key].map(p => JSON.stringify({...filter, [key]: [p]})));
        } else {
            return null;
        }
    } else {
        return whereClause.equals(JSON.stringify(filter));
    }
}

function splitWhereClause(filter: Filter, whereClause:WhereClause<IEvent,any>) : Dexie.Collection<IEvent, number> {
    let r = splitWhereCaluseBy(filter, "authors", whereClause) ||
        splitWhereCaluseBy(filter, "ids", whereClause) ||
        splitWhereCaluseBy(filter, "#p", whereClause) ||
        splitWhereCaluseBy(filter, "#e", whereClause) ||
        splitWhereCaluseBy(filter, null, whereClause);
    if (!r) {
        throw new Error("splitWhereClause bug")
    }
    return r;
}

export function putEvents(filters: Filter[], events: Event[], batchSize:number=30, query_info:QueryInfo|null=null) {
    let toPutArray=getEventsToPut(filters, events, batchSize, query_info);
    return db.events.bulkPut(toPutArray)
}

export function getEventsByFilters(filters: Filter[]):
        Promise<{events: Event[], query_infos: (IEvent&{query_info:QueryInfo})[] }> {
    let filtered:Dexie.Collection<IEvent,number>|undefined;
    for(let filter of filters) {
        let whereClause=(filtered) ? filtered.or("filter") : db.events.where("filter")
        filter={...filter}
        delete filter.limit
        filtered=splitWhereClause(filter, whereClause);
    }
    if(!filtered) {
        return new Promise((resolve)=>{return {events: [], query_infos: []}});
    }
    return filtered.toArray()
            .then(events => {
                    let flat_events=events.map(event => (event.events ||event.event || [])).flat()
                    // @ts-ignore
                    let query_infos: (IEvent&{query_info:QueryInfo})[]=events.filter(event => event.query_info)
                    return {events: flat_events, query_infos};
            });
            
}