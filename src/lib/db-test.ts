/* eslint-env jest */

import "fake-indexeddb/auto";
import { putEvents, getEventsByFilters, clearAllEvents } from "./db";
import type { Filter, Event } from "nostr-tools";

beforeEach(async () => {
    clearAllEvents();
});

test("putEvents", async () => {
    let events:(Event&{id:string})[] = [
        {id: "id1", pubkey: "pub1", tags: [["#p", "p1"], ["#e", "e1"]], kind:0,
            created_at: 1, content: "HW"},
        {id: "id2", pubkey: "pub2", tags: [["#p", "p1"], ["#e", "e1"]], kind:0,
            created_at: 1, content: "HW"},
        ];
    let filters:Filter[] = [{authors: ["pub1", "pub2", "pub3"]}];
    await putEvents(filters, events);
    let result = await getEventsByFilters(filters);
    expect(result).toEqual({events, query_infos: []});
})


test("1author 1kind", async () => {
    let events:(Event&{id:string})[] = [
        {id: "id1", pubkey: "pub1", tags: [["#p", "p1"], ["#e", "e1"]], kind:0,
            created_at: 1, content: "HW"},
        ];
    let filters:Filter[] = [{authors: ["pub1"], kinds: [0]}];
    await putEvents(filters, events);
    let result = await getEventsByFilters(filters);
    expect(result).toEqual({events, query_infos: []});
})


test("multiple authors with kinds", async () => {
    let events:(Event&{id:string})[] = [
        {id: "id1", pubkey: "pub1", tags: [["#p", "p1"], ["#e", "e1"]], kind:0,
            created_at: 1, content: "HW"},
        {id: "id2", pubkey: "pub2", tags: [["#p", "p1"], ["#e", "e1"]], kind:0,
            created_at: 1, content: "HW"},
        ];
    let filters:Filter[] = [{authors: ["pub1", "pub2", "pub3"], kinds: [0]}];
    await putEvents(filters, events);
    let result = await getEventsByFilters(filters);
    expect(result).toEqual({events, query_infos: []});
})



test("reverse filter order", async () => {
    let events:(Event&{id:string})[] = [
        {id: "id1", pubkey: "pub1", tags: [["#p", "p1"], ["#e", "e1"]], kind:0,
            created_at: 1, content: "HW"},
        {id: "id2", pubkey: "pub2", tags: [["#p", "p1"], ["#e", "e1"]], kind:0,
            created_at: 1, content: "HW"},
        ];
    let filters:Filter[] = [{authors: ["pub1", "pub2", "pub3"], kinds: [0]}];
    await putEvents(filters, events);
    let filters_reverse:Filter[] = [{kinds: [0], authors: ["pub1", "pub2", "pub3"]}];
    let result = await getEventsByFilters(filters_reverse);
    expect(result).toEqual({events, query_infos: []});
})
