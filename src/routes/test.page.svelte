<script>
	import {getEventsByFilters} from '$lib/db'
	import Profile from './Profile.svelte'
	import DMs from './DMs.svelte'
	import Contacts from './Contacts.svelte';
	import PublicNotes from './PublicNotes.svelte';
	import Photo from './Photo.svelte';
	import {publishedStore, receivedStore, publishedProfilesStore, publishedProfilesByPubKeyStore,
		contactsStore, eventsFromFollowedStore, subscribeAndCacheResultsStore,
		repliesFilter,
		repliesStore, getEvents} from '$lib/svelte-nostr-stores'
	import { Kind } from 'nostr-tools';
	import {mapBy} from '$lib/collection-helpers'
	export let data;

	let pubKey = data.pubkey;
	console.log("pub key:", pubKey)
	let events=getEvents(pubKey, data.followed)
	$: published=$events.filter(e => e.author==pubKey)
	$: received=$events.filter(e => e.tags.filter(t => t[0]=="p" && t[1]==pubKey).length>0)
	$: kinds=published.map(author => author.kind)
	$: published_profiles=$events.filter(e => e.kind==Kind.Profile)
	$: contacts=$events.filter(e=>e.kind==Kind.Contacts)  // make it reactive
	$: console.log("events:", $events)
	$: console.log("published_profiles:", published_profiles)
	$: publishedProfilesByPubKey=mapBy(published_profiles, item=>item.pubkey)
	let viewauthor;
	let page="posts"

	// Debug
	$: document.publishedProfilesByPubKey=publishedProfilesByPubKey
	document.subscribeAndCacheResultsStore=subscribeAndCacheResultsStore
	document.getEventsByFilters=getEventsByFilters
	$: document.received=received
	$: pageEvents = (viewauthor) ? $events.filter((event)=>event.author==viewauthor) : $events
	$: document.pageEvents=pageEvents
	document.repliesFilter=repliesFilter
	// $: replies = repliesStore(pageEvents)
	// $: document.rstore=replies
	// $: document.replies = $replies
	// $: document.data=data
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>


<section>
	
</section>

<style>
	
</style>