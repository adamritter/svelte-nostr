// Definition for stores that can be used in the client
import {subscribeAndCacheResults} from './nostr-store'
import {unique, mapBy} from './collection-helpers'
import {readable, derived, writable} from 'svelte/store'
import {Kind} from '$lib/nostr-helpers'

export function subscribeAndCacheResultsStore(filter, options) 
{
    return readable([], function start(set) {
        return subscribeAndCacheResults(filter, set, options)
    });
}

export function derivedSubscribeStore(store, filterForResults, options) {
    let unsubscribe=null;
    return readable([], function start(set) {
        store.subscribe((value)=>{
            if(unsubscribe) {
                unsubscribe();
            }
            unsubscribe=subscribeAndCacheResults(filterForResults(value), set, options)
        });
        return ()=>{
            if(unsubscribe) {
                unsubscribe();
            }
        }
    });
}
export let publishedStore=(pubkey, limit=500) => subscribeAndCacheResultsStore({"authors": [pubkey], limit})
export let receivedStore=(pubkey, limit=500) => subscribeAndCacheResultsStore({"#p": [pubkey], limit})
export let publishedProfilesStore=(published, pubkey) => derivedSubscribeStore(published, (events) => {
    let filter={kinds: [0], authors: [pubkey]}
    for (let i=0; i<events.length; i++) {
        let event=events[i]
        filter.authors=unique(filter.authors.concat(event.tags.filter(tag=>tag[0]=="p").map(tag => tag[1])))
    }
    return filter
}, {onlyOne: true})
export let publishedProfilesByPubKeyStore=(published_profiles)=>
    derived(published_profiles, (profiles) => mapBy(profiles, item=>item.pubkey))
export let contactsStore=(published) => derived(published, (events) => {
    let r= (events.findLast(author => author.kind === Kind.Contacts)?.tags.map(tag => tag[1]) || [])
    console.log("contactsStore result: ", r)
    return r;
})
export let filterByKind=(kind) => (events) => events.filter(author => author.kind === kind)
export let eventsFromFollowedStore=(contactsStore, limit=500)=>derivedSubscribeStore(
    contactsStore, (contacts)=>{return {authors: contacts, limit}})

export function localStorageJSONStore(key, defaultValue=null) {
	const { subscribe, set } = writable(JSON.parse(localStorage.getItem(key)) || defaultValue);
    return {
        subscribe,
        set: (value) => {
            localStorage.setItem(key, JSON.stringify(value))
            set(value)
        }
    }
}


export function localStorageStore(key, defaultValue=null) {
	const { subscribe, set } = writable(localStorage.getItem(key) || defaultValue);
    return {
        subscribe,
        set: (value) => {
            localStorage.setItem(key, value)
            set(value)
        }
    }
}


// Profile states: "extension" | "pubkey_extesion" | "pubkey" | "private_key"
export let profileStateLocalStore=()=>localStorageStore("nostr_profile_state")

