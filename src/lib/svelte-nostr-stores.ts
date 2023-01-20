// Definition for stores that can be used in the client
import {subscribeAndCacheResults} from "./subscription";
import {unique, mapBy, groupBy} from "./collection-helpers";
import {readable, derived, writable, type Readable} from "svelte/store";
import {Kind, type Event, type Filter} from "nostr-tools";
import {
  mergeSimilarFilters,
  type ExtendedFilter,
  type Options,
} from "./get-filters-to-request";
import stringify from "safe-stable-stringify";

export function subscribeAndCacheResultsStore(
  filters: ExtendedFilter[],
  options?: Options
): Readable<Event[]> {
  console.log("subscribeAndCacheResultsStore", filters, options);
  return readable([], function start(set: (events: Event[]) => void) {
    return subscribeAndCacheResults(filters, set, options);
  });
}

export function derivedSubscribeStore<T>(
  store: Readable<T>,
  filtersForResults: (value: T) => ExtendedFilter[],
  options?: Options
) {
  let unsubscribe: (() => void) | null = null;
  return readable([], function start(set: (events: Event[]) => void) {
    store.subscribe((value: T) => {
      if (unsubscribe) {
        unsubscribe();
      }
      unsubscribe = subscribeAndCacheResults(
        filtersForResults(value),
        set,
        options
      );
    });
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  });
}
export let publishedStore = (pubkey: string, limit = 500) =>
  subscribeAndCacheResultsStore([{authors: [pubkey], limit}]);
export let receivedStore = (pubkey: string, limit = 500) =>
  subscribeAndCacheResultsStore([{"#p": [pubkey], limit}]);
export let publishedProfilesStore = (
  published: Readable<Event[]>,
  pubkey: string
) =>
  derivedSubscribeStore(
    published,
    (events: Event[]) => {
      let filter: ExtendedFilter = {kinds: [0], authors: [pubkey]};
      console.log("filtering profiles", events);
      for (let i = 0; i < events.length; i++) {
        let event = events[i];
        filter.authors = unique(
          // @ts-ignore
          filter.authors.concat(
            event.tags
              .filter((tag) => tag[0] == "p" && tag[1] && tag[1].length > 8)
              .map((tag) => tag[1])
          )
        );
      }
      return [filter];
    },
    {onlyOne: true}
  );
export let publishedProfilesByPubKeyStore = (
  published_profiles: Readable<Event[]>
) =>
  derived(published_profiles, (profiles) =>
    mapBy(profiles, (item) => item.pubkey)
  );
export let contactsStore = (published: Readable<Event[]>) =>
  derived(published, (events) => {
    let r =
      events
        // @ts-ignore
        .findLast((author) => author.kind === Kind.Contacts)
        // @ts-ignore
        ?.tags.map((tag) => tag[1]) || [];
    return r;
  });
export let filterByKind = (kind: Kind) => (events: Event[]) =>
  events.filter((author) => author.kind === kind);
export let eventsFromFollowedStore = (
  contactsStore: Readable<string[]>,
  limit = 500
) =>
  derivedSubscribeStore(contactsStore, (contacts) => {
    return [{authors: contacts, limit}];
  });

export let repliesFilter = (events: Event[]) => {
  let tags = events
    .filter((event) => event.kind == Kind.Text)
    .map((event) => event.tags)
    .flat()
    .filter((tag) => tag[0] == "e")
    .map((tag) => tag.slice(1));
  // need to deduplicate
  let groupedTags = groupBy(tags, (tag) => tag[0]);
  let es = [];
  for (let [key, tags] of groupedTags) {
    let values = tags.map((tag) => tag.slice(1)).flat();
    es.push([key, ...new Set(values)]);
  }
  return {ids: es};
};

export let repliesStore = (events: Event[]) =>
  derived(
    // @ts-ignore
    subscribeAndCacheResultsStore([repliesFilter(events)], {onlyOne: true}),
    (events) => groupBy(events, (event) => event.id)
  );

export function localStorageJSONStore(key: string, defaultValue = null) {
  const {subscribe, set} = writable(
    // @ts-ignore
    JSON.parse(localStorage.getItem(key)) || defaultValue
  );
  return {
    subscribe,
    set: (value: any) => {
      localStorage.setItem(key, JSON.stringify(value));
      set(value);
    },
  };
}

export function localStorageStore(key: any, defaultValue = null) {
  const {subscribe, set} = writable(localStorage.getItem(key) || defaultValue);
  return {
    subscribe,
    set: (value: any) => {
      localStorage.setItem(key, value);
      set(value);
    },
  };
}

// Profile states: "extension" | "pubkey_extesion" | "pubkey" | "private_key"
export let profileStateLocalStore = () =>
  localStorageStore("nostr_profile_state");

export async function getFollowed(pubkey: string, options: Options = {}) {
  let subscription = subscribeAndCacheResultsStore(
    [{kinds: [Kind.Contacts], authors: [pubkey]}],
    {onlyOne: true, ...options}
  );
  return new Promise((resolve, reject) => {
    subscription.subscribe((events) => {
      if (events.length > 0) {
        resolve(
          events[0].tags.filter((tag) => tag[0] == "p").map((tag) => tag[1])
        );
      }
    });
  });
}

export let getEvents = (
  pubkey: string,
  followed: string[],
  options?: Options
) => {
  return subscribeAndCacheResultsStore(
    [
      {authors: [pubkey], limit: 200},
      {"#p": [pubkey], limit: 200},
      {
        authors: followed.concat([pubkey]),
        kinds: [Kind.Contacts, Kind.Metadata],
      },
      {authors: followed, limit: 1000},
      {"#p": followed, limit: 1000},
    ],
    options
  );
};

export function groupByTag(events: Event[], tag: string) {
  let r: Map<string, Event[]> = new Map();
  for (let event of events) {
    for (let tagstr of event.tags) {
      if (tagstr[0] == tag) {
        let id = tagstr[1];
        let a = r.get(id);
        r.set(id, a || [event]);
      }
    }
  }
  return r;
}

export function stringifyUnique<T>(a: Array<T>): Array<T> {
  let r: Array<T> = [];
  let s = new Set();
  for (let e of a) {
    let str = JSON.stringify(e);
    if (!s.has(str)) {
      s.add(str);
      r.push(e);
    }
  }
  return r;
}

// A lot of filters are returned, they must be merged by the storage layer before subscribing
export function filtersFromEventTags(
  events: Event[],
  pubkey: string,
  followed: string[]
): ExtendedFilter[] {
  // let tags=tagsFromEvents(events, pubkey, followed)
  let allIds = new Set(events.map((event) => event.id));
  let allProfiles = new Set(
    events.filter((event) => event.kind == 0).map((event) => event.pubkey)
  );
  let r: ExtendedFilter[] = [];
  for (let event of events) {
    if (
      event.kind == Kind.Text &&
      (event.pubkey == pubkey || followed.includes(event.pubkey))
    ) {
      for (let tag of event.tags) {
        if (tag[0] == "p") {
          if (allProfiles.has(tag[1])) {
            continue;
          }
          let filter: ExtendedFilter = {authors: [tag[1]], kinds: [0]};
          if (tag[2] && tag[2] != "") {
            filter.relay = tag[2];
          }
          filter.store_filter = stringify({authors: [event.pubkey]});
          r.push(filter);
        } else if (tag[0] == "e") {
          if (allIds.has(tag[1])) {
            continue;
          }
          let filter: ExtendedFilter = {ids: [tag[1]]};
          if (tag[2] && tag[2] != "") {
            filter.relay = tag[2];
          }
          filter.store_filter = stringify({authors: [event.pubkey]});
          r.push(filter);
        }
      }
    }
  }
  return mergeSimilarFilters(stringifyUnique(r));
}

export function suggestions(events: Event[], followed: string[]) {
  let tags = events
    .filter((e) => e.kind == 3 && followed.includes(e.pubkey))
    .map((e) => e.tags);
  let weightsByPubKey = new Map();
  for (let tag of tags) {
    tag = tag.filter((t) => !followed.includes(t[1]));
    for (let tag2 of tag) {
      let key = tag2[1];
      if (followed.includes(key)) {
        continue;
      }
      let weight = weightsByPubKey.get(key) || 0.0;
      weight += 1.0 / tag.length;
      weightsByPubKey.set(key, weight);
    }
  }
  return Array.from(weightsByPubKey).sort((a, b) => b[1] - a[1]);
}
