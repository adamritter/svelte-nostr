import type {RelayPool} from "nostr-relaypool";
import {Kind, type Event} from "nostr-tools";

export class Author {
  pubkey: string;
  relayPool: RelayPool;
  relays: string[];
  constructor(relayPool: RelayPool, relays: string[], pubkey: string) {
    this.pubkey = pubkey;
    this.relayPool = relayPool;
    this.relays = relays;
  }

  metaData(
    cb: (event: Event) => void,
    maxDelayms: number = Infinity
  ): () => void {
    return this.relayPool.subscribe(
      [
        {
          authors: [this.pubkey],
          kinds: [Kind.Metadata],
        },
      ],
      this.relays,
      cb,
      maxDelayms
    );
  }

  followsPubkeys(
    cb: (pubkeys: string[]) => void,
    maxDelayms: number = Infinity
  ): () => void {
    return this.relayPool.subscribe(
      [
        {
          authors: [this.pubkey],
          kinds: [Kind.Contacts],
        },
      ],
      this.relays,
      (event: Event) => {
        let r: string[] = [];
        for (const tag of event.tags) {
          if (tag[0] === "p") {
            r.push(tag[1]);
          }
        }
        cb(r);
      },
      maxDelayms
    );
  }

  follows(
    cb: (authors: Author[]) => void,
    maxDelayms: number = Infinity
  ): () => void {
    return this.followsPubkeys((pubkeys: string[]) => {
      cb(
        pubkeys.map((pubkey) => new Author(this.relayPool, this.relays, pubkey))
      );
    }, maxDelayms);
  }

  allEvents(
    cb: (event: Event[]) => void,
    limit = 100,
    maxDelayms: number = Infinity
  ): () => void {
    return this.relayPool.subscribe(
      [
        {
          authors: [this.pubkey],
          limit,
        },
      ],
      this.relays,
      cb,
      maxDelayms
    );
  }

  referenced(
    cb: (event: Event[]) => void,
    limit = 100,
    maxDelayms: number = Infinity
  ): () => void {
    return this.relayPool.subscribe(
      [
        {
          "#p": [this.pubkey],
          limit,
        },
      ],
      this.relays,
      cb,
      maxDelayms
    );
  }

  followers(
    cb: (event: Event[]) => void,
    limit = 100,
    maxDelayms: number = Infinity
  ): () => void {
    return this.relayPool.subscribe(
      [
        {
          "#p": [this.pubkey],
          kinds: [Kind.Contacts],
          limit,
        },
      ],
      this.relays,
      cb,
      maxDelayms
    );
  }
}
