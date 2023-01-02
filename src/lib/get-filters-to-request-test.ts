/* eslint-env jest */

import { getFiltersToRequest, type ExtendedFilter } from "./get-filters-to-request";
import type { Filter, Event } from "nostr-tools";

test("id_only_one", () => {
    let filter:ExtendedFilter = {ids: ["id1", "id2", "id3"]};
    let events:Event[] = [
        {id: "id1", pubkey: "pub1", tags: [["#p", "p1"], ["#e", "e1"]], kind:0,
            created_at: 1, content: "HW"},
        {id: "id2", pubkey: "pub2", tags: [["#p", "p1"], ["#e", "e1"]], kind:0,
            created_at: 1, content: "HW"},
        ];
    let filters=[filter];
    let result = getFiltersToRequest("sub", filters, {}, events, []);
    expect(result).toEqual([{ids: ["id3"]}]);
});


test("multiple_authors", () => {
    let filter:ExtendedFilter = {authors: ["pub1", "pub2", "pub3"], retrieve_old: true};
    let events:Event[] = [
        {id: "id1", pubkey: "pub1", tags: [["#p", "p1"], ["#e", "e1"]], kind:0,
            created_at: 1, content: "HW"},
        {id: "id2", pubkey: "pub2", tags: [["#p", "p1"], ["#e", "e1"]], kind:0,
            created_at: 2, content: "HW"},
        ];
    let result = getFiltersToRequest("sub", [filter], {}, events, []);
    expect(result).toEqual([{authors: ["pub1", "pub2", "pub3"]}]);
});


test("authors with times", () => {
    let filter:ExtendedFilter = {authors: ["pub1", "pub2", "pub3"]};
    let events:Event[] = [
        {id: "id1", pubkey: "pub1", tags: [["#p", "p1"], ["#e", "e1"]], kind:0,
            created_at: 1, content: "HW"},
        {id: "id2", pubkey: "pub2", tags: [["#p", "p1"], ["#e", "e1"]], kind:0,
            created_at: 2, content: "HW"},
        {id: "id3", pubkey: "pub2", tags: [["#p", "p1"], ["#e", "e1"]], kind:0,
            created_at: 1, content: "HW"},
        ];
    let result = getFiltersToRequest("sub", [filter], {}, events, []);
    expect(result).toEqual([{authors: ["pub1"], since: 2}, {authors: ["pub2"], since: 3}, {authors: ["pub3"]}]);
});

test("Multiple filters", () => {
    let filter1:ExtendedFilter = {authors: ["pub1", "pub2", "pub3"]};
    let filter2:ExtendedFilter = {authors: ["pub1", "pub2", "pub3"], retrieve_old: true};
    let events:Event[] = [
        {id: "id1", pubkey: "pub1", tags: [["#p", "p1"], ["#e", "e1"]], kind:0,
            created_at: 1, content: "HW"},
        {id: "id2", pubkey: "pub2", tags: [["#p", "p1"], ["#e", "e1"]], kind:0,
            created_at: 2, content: "HW"},
        {id: "id3", pubkey: "pub2", tags: [["#p", "p1"], ["#e", "e1"]], kind:0,
            created_at: 1, content: "HW"},
        ];
    let result = getFiltersToRequest("sub", [filter1, filter2], {}, events, []);
    expect(result).toEqual([{authors: ["pub1"], since: 2}, {authors: ["pub2"], since: 3}, {authors: ["pub3"]}, {authors: ["pub1", "pub2", "pub3"]}]);
});

test("Empty filters", () => {
    let filter1:ExtendedFilter = {authors: []};
    let filter2:ExtendedFilter = {ids: []};
    let events:Event[] = [];
    let result = getFiltersToRequest("sub", [filter1, filter2], {}, events, []);
    expect(result).toEqual(undefined);
});