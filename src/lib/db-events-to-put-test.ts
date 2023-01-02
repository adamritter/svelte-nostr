/* eslint-env jest */

import { Kind, type Event } from "nostr-tools";
import { getEventsToPut } from "./db-events-to-put";

it('should return an empty array if no events are passed', () => {
    const filter = { authors: ['author1'], ids: ['id1'], '#p': ['p1'], '#e': ['e1'] };
    const events:Event[] = [];
    const result = getEventsToPut([filter], events);
    expect(result.length).toBe(0);
});

it('should return a map with the correct number of keys for each filter', () => {
    const filter = { authors: ['author1', 'author2'] };
    const events = [ 
        {pubkey: 'author1', ids: 'id1', tags: [['#p', 'p1'], ['#e', 'e1']], kind: Kind.Text, created_at: 1, content: "HW" },
        { pubkey: 'author1', ids: 'id3', tags: [['#p', 'p1'], ['#e', 'e1']], kind: Kind.Text, created_at: 1, content: "HW" },
        { pubkey: 'author1', ids: 'id2', tags: [['#p', 'p1'], ['#e', 'e1']], kind: Kind.Text, created_at: 2, content: "HW" },
        { pubkey: 'author2', ids: 'id4', tags: [['#p', 'p2'], ['#e', 'e2']], kind: Kind.Text, created_at: 1, content: "HW" },
        { pubkey: 'author2', ids: 'id5', tags: [['#p', 'p2'], ['#e', 'e2']], kind: Kind.Text, created_at: 1, content: "HW" },
        { pubkey: 'author2', ids: 'id6', tags: [['#p', 'p2'], ['#e', 'e2']], kind: Kind.Text, created_at: 1, content: "HW" },
    ];
    const result = getEventsToPut([filter], events);
    expect(result).toEqual([
    { filter: JSON.stringify({ authors: ['author1'] }), events: events.slice(0, 3) },
    { filter: JSON.stringify({ authors: ['author2'] }), events: events.slice(3, 6) },
    ]);
});


it('should correctly add query info simple', () => {
    const filter = { authors: ['a1']};
    const events: Event[] = [];
    let query_info = { eose_received_at: 1, total_events: 2, last_req_sent_at: 1, new_events: 1, received_events: 1, req_sent_at: 1 };
    const result = getEventsToPut([filter], events, 1, query_info);
    expect(result).toEqual([
    { filter: JSON.stringify({ authors: ['a1'] }), query_info},
    ]);
});

it('should correctly add query info', () => {
    const filter = { authors: ['author1', 'author2']};
    const events = [{ pubkey: 'author1', ids: 'id1', tags: [['#p', 'p1'], ['#e', 'e1']], kind: Kind.Text, created_at: 1, content: "HW" },
    ];
    let query_info = { eose_received_at: 1, total_events: 2, last_req_sent_at: 1, new_events: 1, received_events: 1, req_sent_at: 1 };
    const result = getEventsToPut([filter], events, 1, query_info);
    expect(result).toEqual([
    { filter: JSON.stringify({ authors: ['author1'] }), events: events.slice(0, 1) },
    { filter: JSON.stringify({ authors: ['author1'] }), query_info},
    { filter: JSON.stringify({ authors: ['author2'] }), query_info},
    ]);
});