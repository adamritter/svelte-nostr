/* eslint-env jest */

import { getEventsToPut } from "./db-events-to-put";

it('should return an empty array if no events are passed', () => {
    const filter = { authors: ['author1'], ids: ['id1'], '#p': ['p1'], '#e': ['e1'] };
    const events = [];
    const result = getEventsToPut(filter, events);
    expect(result.length).toBe(0);
});

it('should return a map with the correct number of keys for each filter', () => {
    const filter = { authors: ['author1', 'author2'] };
    const events = [      { pubkey: 'author1', ids: 'id1', tags: [['#p', 'p1'], ['#e', 'e1']] },
    { pubkey: 'author1', ids: 'id1', tags: [['#p', 'p1'], ['#e', 'e1']] },
    { pubkey: 'author1', ids: 'id1', tags: [['#p', 'p1'], ['#e', 'e1']] },
    { pubkey: 'author2', ids: 'id2', tags: [['#p', 'p2'], ['#e', 'e2']] },
    { pubkey: 'author2', ids: 'id2', tags: [['#p', 'p2'], ['#e', 'e2']] },
    { pubkey: 'author2', ids: 'id2', tags: [['#p', 'p2'], ['#e', 'e2']] },
    ];
    const result = getEventsToPut(filter, events);
    expect(result).toEqual([
    { filter: JSON.stringify({ authors: ['author1'] }), events: events.slice(0, 3) },
    { filter: JSON.stringify({ authors: ['author2'] }), events: events.slice(3, 6) },
    ]);
});


it('should correctly add query info simple', () => {
    const filter = { authors: ['a1']};
    const events = [];
    const result = getEventsToPut(filter, events, 1, { since: 2 });
    expect(result).toEqual([
    { filter: JSON.stringify({ authors: ['a1'] }), query_info: { since: 2 } },
    ]);
});

it('should correctly add query info', () => {
    const filter = { authors: ['author1', 'author2']};
    const events = [      { pubkey: 'author1', ids: 'id1', tags: [['#p', 'p1'], ['#e', 'e1']] },
    ];
    const result = getEventsToPut(filter, events, 1, { since: 1, until: 2 });
    expect(result).toEqual([
    { filter: JSON.stringify({ authors: ['author1'] }), events: events.slice(0, 1) },
    { filter: JSON.stringify({ authors: ['author1'] }), query_info: { since: 1, until: 2 } },
    { filter: JSON.stringify({ authors: ['author2'] }), query_info: { since: 1, until: 2 } },
    ]);
});