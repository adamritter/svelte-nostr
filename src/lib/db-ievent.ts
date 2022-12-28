import type { Event, Filter } from "nostr-tools";

export type QueryInfo={
    eose_received_at?: number,
    total_events?: number,
    last_req_sent_at?: number|undefined,
    new_events?: number,
    received_events: number,
    req_sent_at?: number,
    db_queried_at?: number,
}

export interface IEvent {
    filter: string;
    event?: Event;
    events?: Event[];
    query_info?: QueryInfo;
  }