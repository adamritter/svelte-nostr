/* eslint-env jest */

import {
  getFiltersToRequest,
  type ExtendedFilter,
} from "./get-filters-to-request";
import type {Filter, Event} from "nostr-tools";

test("id_only_one", () => {
  let filter: ExtendedFilter = {ids: ["id1", "id2", "id3"]};
  let events: Event[] = [
    {
      id: "id1",
      pubkey: "pub1",
      tags: [
        ["#p", "p1"],
        ["#e", "e1"],
      ],
      kind: 0,
      created_at: 1,
      content: "HW",
    },
    {
      id: "id2",
      pubkey: "pub2",
      tags: [
        ["#p", "p1"],
        ["#e", "e1"],
      ],
      kind: 0,
      created_at: 1,
      content: "HW",
    },
  ];
  let filters = [filter];
  let result = getFiltersToRequest("sub", filters, {}, events, []);
  expect(result).toEqual([{ids: ["id3"]}]);
});

test("multiple_authors", () => {
  let filter: ExtendedFilter = {
    authors: ["pub1", "pub2", "pub3"],
    retrieve_old: true,
  };
  let events: Event[] = [
    {
      id: "id1",
      pubkey: "pub1",
      tags: [
        ["#p", "p1"],
        ["#e", "e1"],
      ],
      kind: 0,
      created_at: 1,
      content: "HW",
    },
    {
      id: "id2",
      pubkey: "pub2",
      tags: [
        ["#p", "p1"],
        ["#e", "e1"],
      ],
      kind: 0,
      created_at: 2,
      content: "HW",
    },
  ];
  let result = getFiltersToRequest("sub", [filter], {}, events, []);
  expect(result).toEqual([{authors: ["pub1", "pub2", "pub3"]}]);
});

test("authors with times", () => {
  let filter: ExtendedFilter = {authors: ["pub1", "pub2", "pub3"], limit: 200};
  let events: Event[] = [
    {
      id: "id1",
      pubkey: "pub1",
      tags: [
        ["#p", "p1"],
        ["#e", "e1"],
      ],
      kind: 0,
      created_at: 1,
      content: "HW",
    },
    {
      id: "id2",
      pubkey: "pub2",
      tags: [
        ["#p", "p1"],
        ["#e", "e1"],
      ],
      kind: 0,
      created_at: 2,
      content: "HW",
    },
    {
      id: "id3",
      pubkey: "pub2",
      tags: [
        ["#p", "p1"],
        ["#e", "e1"],
      ],
      kind: 0,
      created_at: 1,
      content: "HW",
    },
  ];
  let result = getFiltersToRequest("sub", [filter], {}, events, [
    {
      filter: '{"authors":["pub1"]}',
      query_info: {req_sent_at: 5, received_events: 1},
    },
    {
      filter: '{"authors":["pub2"]}',
      query_info: {req_sent_at: 5, received_events: 1},
    },
  ]);
  expect(result).toEqual([
    {authors: ["pub1", "pub2"], limit: 133, since: 6},
    {authors: ["pub3"], limit: 67},
  ]);
});

test("#ps with times", () => {
  let filter: ExtendedFilter = {"#p": ["p1", "p2", "p3"], limit: 200};
  let events: Event[] = [
    {
      id: "id1",
      pubkey: "pub1",
      tags: [
        ["#p", "p1"],
        ["#e", "e1"],
      ],
      kind: 0,
      created_at: 1,
      content: "HW",
    },
    {
      id: "id2",
      pubkey: "pub2",
      tags: [
        ["#p", "p2"],
        ["#e", "e1"],
      ],
      kind: 0,
      created_at: 2,
      content: "HW",
    },
    {
      id: "id3",
      pubkey: "pub2",
      tags: [
        ["#p", "p1"],
        ["#e", "e1"],
      ],
      kind: 0,
      created_at: 1,
      content: "HW",
    },
  ];
  let result = getFiltersToRequest("sub", [filter], {}, events, [
    {filter: '{"#p":["p1"]}', query_info: {req_sent_at: 5, received_events: 1}},
    {filter: '{"#p":["p2"]}', query_info: {req_sent_at: 5, received_events: 1}},
  ]);
  expect(result).toEqual([
    {"#p": ["p1", "p2"], limit: 133, since: 6},
    {"#p": ["p3"], limit: 67},
  ]);
});

test("Multiple filters with similar times", () => {
  let filter1: ExtendedFilter = {authors: ["pub1", "pub2", "pub3"]};
  let filter2: ExtendedFilter = {
    authors: ["pub1", "pub2", "pub3"],
    retrieve_old: true,
  };
  let events: Event[] = [
    {
      id: "id1",
      pubkey: "pub1",
      tags: [
        ["#p", "p1"],
        ["#e", "e1"],
      ],
      kind: 0,
      created_at: 1,
      content: "HW",
    },
    {
      id: "id2",
      pubkey: "pub2",
      tags: [
        ["#p", "p1"],
        ["#e", "e1"],
      ],
      kind: 0,
      created_at: 2,
      content: "HW",
    },
    {
      id: "id3",
      pubkey: "pub2",
      tags: [
        ["#p", "p1"],
        ["#e", "e1"],
      ],
      kind: 0,
      created_at: 1,
      content: "HW",
    },
  ];
  let result = getFiltersToRequest("sub", [filter1, filter2], {}, events, []);
  expect(result).toEqual([
    {authors: ["pub1", "pub2"], since: 2},
    {authors: ["pub3"]},
    {authors: ["pub1", "pub2", "pub3"]},
  ]);
});

test("Multiple filters with different times", () => {
  let filter1: ExtendedFilter = {authors: ["pub1", "pub2", "pub3"]};
  let filter2: ExtendedFilter = {
    authors: ["pub1", "pub2", "pub3"],
    retrieve_old: true,
  };
  let events: Event[] = [
    {
      id: "id1",
      pubkey: "pub1",
      tags: [
        ["#p", "p1"],
        ["#e", "e1"],
      ],
      kind: 0,
      created_at: 3600,
      content: "HW",
    },
    {
      id: "id2",
      pubkey: "pub2",
      tags: [
        ["#p", "p1"],
        ["#e", "e1"],
      ],
      kind: 0,
      created_at: 7200,
      content: "HW",
    },
    {
      id: "id3",
      pubkey: "pub2",
      tags: [
        ["#p", "p1"],
        ["#e", "e1"],
      ],
      kind: 0,
      created_at: 3600,
      content: "HW",
    },
  ];
  let result = getFiltersToRequest("sub", [filter1, filter2], {}, events, []);
  expect(result).toEqual([
    {authors: ["pub1"], since: 3601},
    {authors: ["pub2"], since: 7201},
    {authors: ["pub3"]},
    {authors: ["pub1", "pub2", "pub3"]},
  ]);
});

test("Empty filters", () => {
  let filter1: ExtendedFilter = {authors: []};
  let filter2: ExtendedFilter = {ids: []};
  let events: Event[] = [];
  let result = getFiltersToRequest("sub", [filter1, filter2], {}, events, []);
  expect(result).toEqual(undefined);
});

test("Author with since", () => {
  let filter: ExtendedFilter = {authors: ["pub1"], limit: 200};
  let result = getFiltersToRequest(
    "sub",
    [filter],
    {},
    [{pubkey: "pub1", created_at: 1, kind: 0, tags: [], content: ""}],
    []
  );
  expect(result).toEqual([{authors: ["pub1"], limit: 200, since: 2}]);
});

test("Tag filters with similar times", () => {
  let filter: ExtendedFilter = {"#p": ["p1", "p2"]};
  let events: Event[] = [
    {
      id: "id1",
      pubkey: "pub1",
      tags: [
        ["p", "p1"],
        ["e", "e1"],
      ],
      kind: 0,
      created_at: 1,
      content: "HW",
    },
    {
      id: "id2",
      pubkey: "pub2",
      tags: [
        ["p", "p1"],
        ["e", "e1"],
      ],
      kind: 0,
      created_at: 2,
      content: "HW",
    },
    {
      id: "id3",
      pubkey: "pub2",
      tags: [
        ["p", "p1"],
        ["p", "p2"],
      ],
      kind: 0,
      created_at: 1,
      content: "HW",
    },
  ];
  let result = getFiltersToRequest("sub", [filter], {}, events, []);
  expect(result).toEqual([{"#p": ["p1", "p2"], since: 2}]);
});

test("Tag filters with different times", () => {
  let filter: ExtendedFilter = {"#p": ["p1", "p2"]};
  let events: Event[] = [
    {
      id: "id1",
      pubkey: "pub1",
      tags: [
        ["p", "p1"],
        ["e", "e1"],
      ],
      kind: 0,
      created_at: 3600,
      content: "HW",
    },
    {
      id: "id2",
      pubkey: "pub2",
      tags: [
        ["p", "p1"],
        ["e", "e1"],
      ],
      kind: 0,
      created_at: 7200,
      content: "HW",
    },
    {
      id: "id3",
      pubkey: "pub2",
      tags: [
        ["p", "p1"],
        ["p", "p2"],
      ],
      kind: 0,
      created_at: 3600,
      content: "HW",
    },
  ];
  let result = getFiltersToRequest("sub", [filter], {}, events, []);
  expect(result).toEqual([
    {"#p": ["p1"], since: 7201},
    {"#p": ["p2"], since: 3601},
  ]);
});

test("Merge filters automatically", () => {
  let filters: ExtendedFilter[] = [
    {authors: ["pub1"], kinds: [0, 2]},
    {ids: ["1"]},
    {"#p": ["p1", "p2"]},
    {authors: ["pub2"], kinds: [0, 2]},
    {ids: ["5"]},
    {"#p": ["p2", "p3"]},
  ];
  let result = getFiltersToRequest("sub", filters, {}, [], []);
  expect(result).toEqual([
    {authors: ["pub1", "pub2"], kinds: [0, 2]},
    {ids: ["1", "5"]},
    {"#p": ["p1", "p2", "p3"]},
  ]);
});
