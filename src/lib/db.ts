
import Dexie from 'dexie';
import { getEventsToPut } from './db-events-to-put';
import type { Event, Filter } from 'nostr-tools';
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
  
const db=new EventsDB();

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

export function putEvents(filter: Filter, events: Event[], batchSize:number=30, query_info:QueryInfo|null=null) {
    let toPutArray=getEventsToPut(filter, events, batchSize, query_info);
    return db.events.bulkPut(toPutArray)
}

