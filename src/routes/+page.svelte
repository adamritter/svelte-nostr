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
		repliesStore, getEvents, groupByTag} from '$lib/svelte-nostr-stores'
	import { Kind } from 'nostr-tools';
	import {groupBy, mapBy} from '$lib/collection-helpers'
	import { simplifiedFilter } from '$lib/get-filters-to-request';
	import { sortByCreatedAt } from '$lib/helpers';
	import { relays, subdebug } from '$lib/subscription';
	export let data;

	let pubKey = data.pubkey;
	console.log("pub key:", pubKey)
	let events=getEvents(pubKey, data.followed, {offline: true})
	window.getEventsOnline=()=> {
		events=getEvents(pubKey, data.followed)
	}
	window.getEventsByFilters=getEventsByFilters
	window.simplifiedFilter=simplifiedFilter;
	$: window.events=$events
	$: window.followed = data.followed
	$: window.pubkey = pubKey
	$: published=$events.filter(e => e.author==pubKey)
	$: received=$events.filter(e => e.tags.filter(t => t[0]=="p" && t[1]==pubKey).length>0)
	$: kinds=published.map(author => author.kind)
	$: published_profiles=$events.filter(e => e.kind==Kind.Metadata)
	$: contacts=data.followed  // make it reactive
	$: publishedProfilesByPubKey=mapBy(published_profiles, item=>item.pubkey)
	$: eventsByEventRef=groupByTag($events, "e")
	let viewauthor;
	let page="posts_replies"
	window.mapBy=mapBy
	window.timeit=(cb)=>{console.time("timeit"); let r=cb(); console.timeEnd("timeit"); return r}

	// Debug
	$: window.publishedProfilesByPubKey=publishedProfilesByPubKey
	document.subscribeAndCacheResultsStore=subscribeAndCacheResultsStore
	document.getEventsByFilters=getEventsByFilters
	$: window.received=received
	$: pageEvents = (viewauthor) ? $events.filter((event)=>event.pubkey==viewauthor) :
		$events.filter((event)=>(event.pubkey==pubKey || followed.includes(event.pubkey)))
	// $: pageEvents = (viewauthor) ? $events.filter((event)=>event.author==viewauthor) : $events
	$: window.pageEvents=pageEvents
	window.repliesFilter=repliesFilter
	// $: replies = repliesStore(pageEvents)
	// $: document.rstore=replies
	// $: document.replies = $replies
	$: document.data=data
	window.sortByCreatedAt = sortByCreatedAt
	window.groupByTag=groupByTag
	$: window.eventsByEventRef=eventsByEventRef
	window.subdebug = subdebug
	window.relays = relays
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>


<section>
	<a href="" on:click={()=>{page="posts"; viewauthor=null}}><b>Posts</b></a>
	<a href="" on:click={()=>{page="posts_replies"; viewauthor=null}}><b>Posts and replies</b></a>
	<a href="" on:click={()=>page="contacts"}><b>Contacts</b></a>
	<a href="" on:click={()=>page="dms"}><b>DMs</b></a>

	<!--  5: event deletion, 6???, 7: reaction-->
	<span>
	<Photo data={publishedProfilesByPubKey[pubKey]}
		on:click={()=>viewauthor=pubKey} />
	<Profile data={publishedProfilesByPubKey[pubKey]} pubkey={pubKey} />
	</span>
	<span style="display: flex; gap: 20px; flex-direction: row">
		<span style:display={(page=="posts") ? "block" : "none"}>
			<PublicNotes only_posts=true events={pageEvents}
				profilesByPubKey={publishedProfilesByPubKey}
				on:viewauthor={(e)=>{viewauthor=e.detail; page="posts_replies"}}/></span>
		<span style:display={(page=="posts_replies") ? "block" : "none"}>
			<PublicNotes events={pageEvents}
				profilesByPubKey={publishedProfilesByPubKey}
				eventsByEventRef={eventsByEventRef}
				on:viewauthor={(e)=>{viewauthor=e.detail; page="posts_replies"}} />
		</span>
		{#if data.private_key} <!-- TODO: use window.nostr encode / decode instead if the private key doesn't exist -->
		<span style:display={(page=="dms") ? "block" : "none"}><DMs events={events} privKey={data.private_key} pubKey={pubKey} profilesByPubKey={publishedProfilesByPubKey} /></span>
		{/if}
		<span style="flex-basis: 500px; display: block">
			<Contacts contacts={contacts} profilesByPubKey={publishedProfilesByPubKey}
			on:viewauthor={(e)=>{viewauthor=e.detail; page="posts_replies"}} 
			/>
		</span>
	</span>
	
	<!-- <h1>Kinds</h1><p>{kinds}</p> -->
</section>

<style>
	
</style>