// Definition for stores that can be used in the client
import {subscribeAndCacheResults} from './subscription'
import {unique, mapBy, groupBy} from './collection-helpers'
import {readable, derived, writable, type Readable} from 'svelte/store'
import {Kind, type Event, type Filter} from 'nostr-tools'
import type { ExtendedFilter, Options } from './get-filters-to-request';

export function subscribeAndCacheResultsStore(filters: ExtendedFilter[], options?: Options) 
    : Readable<Event[]>
{
    console.log("subscribeAndCacheResultsStore", options)
    return readable([], function start(set: (events: Event[]) => void) {
        return subscribeAndCacheResults(filters, set, options)
    });
}

export function derivedSubscribeStore<T>(store: Readable<T>, 
        filtersForResults: (value: T)=>ExtendedFilter[], options?: Options) {
    let unsubscribe:(()=>void)|null=null;
    return readable([], function start(set: (events: Event[]) => void) {
        store.subscribe((value:T)=>{
            if(unsubscribe) {
                unsubscribe();
            }
            unsubscribe=subscribeAndCacheResults(filtersForResults(value), set, options)
        });
        return ()=>{
            if(unsubscribe) {
                unsubscribe();
            }
        }
    });
}
export let publishedStore=(pubkey: string, limit=500) => subscribeAndCacheResultsStore([{"authors": [pubkey], limit}])
export let receivedStore=(pubkey: string, limit=500) => subscribeAndCacheResultsStore([{"#p": [pubkey], limit}])
export let publishedProfilesStore=(published:Readable<Event[]>, pubkey: string) =>
         derivedSubscribeStore(published, (events:Event[]) => {
    let filter:ExtendedFilter={kinds: [0], authors: [pubkey]}
    console.log("filtering profiles", events)
    for (let i=0; i<events.length; i++) {
        let event=events[i]
        // @ts-ignore
        filter.authors=unique(filter.authors.concat(event.tags.filter(tag=>tag[0]=="p" && tag[1] && tag[1].length > 8).map(tag => tag[1])))
    }
    return [filter]
}, {onlyOne: true})
export let publishedProfilesByPubKeyStore=(published_profiles: Readable<Event[]>)=>
    derived(published_profiles, (profiles) => mapBy(profiles, item=>item.pubkey))
export let contactsStore=(published:Readable<Event[]>) => derived(published, (events) => {
    // @ts-ignore
    let r= (events.findLast(author => author.kind === Kind.Contacts)?.tags.map(tag => tag[1]) || [])
    return r;
})
export let filterByKind=(kind: Kind) => (events: Event[]) => events.filter(author => author.kind === kind)
export let eventsFromFollowedStore=(contactsStore: Readable<string[]>, limit=500)=>derivedSubscribeStore(
    contactsStore, (contacts)=>{return [{authors: contacts, limit}]})

export let repliesFilter=(events:Event[]) =>{
    let tags=events.filter((event)=>event.kind==Kind.Text).map((event)=>event.tags).flat()
    .filter((tag)=>tag[0]=="e").map((tag)=>tag.slice(1));
    // need to deduplicate
    let groupedTags=groupBy(tags, (tag)=>tag[0])
    let es=[]
    for(let [key, tags] of groupedTags) {
        let values=tags.map((tag)=>tag.slice(1)).flat();
        es.push([key, ...new Set(values)])
    }
    return {"ids": es}
}

export let repliesStore=(events: Event[])=>derived(subscribeAndCacheResultsStore(
    [repliesFilter(events)], {onlyOne: true}),
    (events)=>groupBy(events, (event)=>event.id))

export function localStorageJSONStore(key: string, defaultValue=null) {
    // @ts-ignore
	const { subscribe, set } = writable(JSON.parse(localStorage.getItem(key)) || defaultValue);
    return {
        subscribe,
        set: (value: any) => {
            localStorage.setItem(key, JSON.stringify(value))
            set(value)
        }
    }
}

export function localStorageStore(key: any, defaultValue=null) {
	const { subscribe, set } = writable(localStorage.getItem(key) || defaultValue);
    return {
        subscribe,
        set: (value: any) => {
            localStorage.setItem(key, value)
            set(value)
        }
    }
}


// Profile states: "extension" | "pubkey_extesion" | "pubkey" | "private_key"
export let profileStateLocalStore=()=>localStorageStore("nostr_profile_state")

export async function getFollowed(pubkey: string, options: Options={}) {
    let subscription=subscribeAndCacheResultsStore([
        {"kinds": [Kind.Contacts], "authors": [pubkey]}], {onlyOne: true, ...options})
    return new Promise((resolve, reject)=>{
        subscription.subscribe((events)=>{
            if(events.length > 0) {
                resolve(events[0].tags.filter((tag)=>tag[0]=="p").map((tag)=>tag[1]))
            }
        })
    })
}

export let getEvents=(pubkey: string, followed: string[], options?:Options)=>subscribeAndCacheResultsStore([
    {"authors": [pubkey], limit: 200},
    {"#p": [pubkey], limit: 200},
    {"authors": [pubkey], "kinds": [Kind.Contacts]},
    {"authors": [pubkey], "kinds": [Kind.Metadata]},
    {"authors": followed, limit: 50},
    {"#p": followed, limit: 50},
    {"authors": followed, "kinds": [Kind.Contacts]},
    {"authors": followed, "kinds": [Kind.Metadata]},
], options)

