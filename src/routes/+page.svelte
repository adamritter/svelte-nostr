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
		repliesStore, getEvents, groupByTag, stringifyUnique, filtersFromEventTags} from '$lib/svelte-nostr-stores'
	import { Kind } from 'nostr-tools';
	import {groupBy, mapBy} from '$lib/collection-helpers'
	import { mergeSimilarFilters, requestFilter } from '$lib/get-filters-to-request';
	import { sortByCreatedAt } from '$lib/helpers';
	import { relays, subdebug } from '$lib/subscription';
	import { tick } from 'svelte';
	import {db} from '$lib/db'
	window.db=db

	export let data;
	let events = getEvents(data.pubkey, data.followed, {offline: true})
	window.stringifyUnique=stringifyUnique
	window.filtersFromEventTags=filtersFromEventTags
	window.mergeSimilarFilters=mergeSimilarFilters
	let tags=undefined
	setTimeout(()=> {
		console.log($events)
		// tags=subscribeAndCacheResultsStore(mergeSimilarFilters(filtersFromEventTags($events, pubKey, data.followed)))
	}, 5000)
	$: window.tags=tags ? $tags : undefined

	let pubKey = data.pubkey;
	console.log("pub key:", pubKey)
	window.getEventsOnline=()=> {
		events=getEvents(pubKey, data.followed)
	}
	window.getEventsByFilters=getEventsByFilters
	window.requestFilter=requestFilter;
	$: window.events=$events
	$: window.followed = data.followed
	$: window.pubkey = pubKey
	$: published=$events.filter(e => e.author==pubKey)
	$: received=$events.filter(e => e.tags.filter(t => t[0]=="p" && t[1]==pubKey).length>0)
	$: kinds=published.map(author => author.kind)
	$: published_profiles=$events.filter(e => e.kind==Kind.Metadata)
	$: contacts=data.followed  // make it reactive
	$: publishedProfilesByPubKey=mapBy(published_profiles, item=>item.pubkey)
	$: eventsById=mapBy($events, item=>item.id)
	$: window.eventsById=eventsById
	$: eventsByEventRef=groupByTag($events, "e")
	$: window.subscribeAndCacheResultsStore=subscribeAndCacheResultsStore
	let pageInfo={page: "posts_replies", viewauthor: null}
	window.mapBy=mapBy
	window.timeit=(cb)=>{console.time("timeit"); let r=cb(); console.timeEnd("timeit"); return r}

	let startTime=Date.now()

	// Debug
	$: window.publishedProfilesByPubKey=publishedProfilesByPubKey
	document.subscribeAndCacheResultsStore=subscribeAndCacheResultsStore
	document.getEventsByFilters=getEventsByFilters
	$: window.received=received
	$: pageEventsFinal = (pageInfo.viewauthor) ? $events.filter((event)=>event.pubkey==pageInfo.viewauthor) :
		$events.filter((event)=>(event.pubkey==pubKey || followed.includes(event.pubkey)))
	let rendered = false;

    function only_post_filter(event) {
        return event.kind === Kind.Text && (pageInfo.page=="posts" ? (event.tags.every(tag => tag[0] !== "e")) : true);
    }
	function pageEventsFromFinal(final) {
		if (rendered) return final;
		let filtered = final.filter(only_post_filter)
		let r = sortByCreatedAt(filtered).slice(0, 10);
		if(filtered.length >= 10) {
			console.log(Date.now()-startTime, filtered.length, r.length)
			setTimeout(()=> {
				rendered = true;
				pageEvents = pageEventsFinal;
				console.log(Date.now()-startTime, filtered.length)
			}, 100)
		}
		return r
	}
	$: pageEvents = (pageEventsFromFinal(pageEventsFinal))
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

{#if $events.length>0}

<section>
	<a href="" on:click={()=>{startTime=Date.now(); rendered = false; pageInfo={page: "posts", viewauthor: null}}}><b>Posts</b></a>
	<a href="" on:click={()=>{startTime=Date.now(); rendered = false; pageInfo={page: "posts_replies", viewauthor: null} }}><b>Posts and replies</b></a>
	<a href="" on:click={()=>pageInfo.page="contacts"}><b>Contacts</b></a>
	<a href="" on:click={()=>pageInfo.page="dms"}><b>DMs</b></a>

	<!--  5: event deletion, 6???, 7: reaction-->
	<span>
	<Photo data={publishedProfilesByPubKey.get(pubKey)}
		on:click={()=>{rendered=false;pageInfo={viewauthor: pubKey, page: "posts_replies"}}} />
	<Profile data={publishedProfilesByPubKey.get(pubKey)} pubkey={pubKey} />
	</span>
	<span style="display: flex; gap: 20px; flex-direction: row">
		<span style:display={(pageInfo.page=="posts") ? "block" : "none"}>
			<PublicNotes only_posts=true events={pageEvents}
				profilesByPubKey={publishedProfilesByPubKey}
				on:viewauthor={(e)=>{rendered=false;pageInfo={viewauthor: e.detail, page: "posts_replies"}}}/></span>
		<span style:display={(pageInfo.page=="posts_replies") ? "block" : "none"}>
			<PublicNotes events={pageEvents}
				profilesByPubKey={publishedProfilesByPubKey}
				eventsByEventRef={eventsByEventRef}
				on:viewauthor={(e)=>{rendered=false;pageInfo={viewauthor: e.detail, page: "posts_replies"}}} />
		</span>
		{#if data.private_key} <!-- TODO: use window.nostr encode / decode instead if the private key doesn't exist -->
		<span style:display={(pageInfo.page=="dms") ? "block" : "none"}><DMs events={events} privKey={data.private_key} pubKey={pubKey} profilesByPubKey={publishedProfilesByPubKey} /></span>
		{/if}
		<span style="flex-basis: 500px; display: block">
			<Contacts contacts={contacts} profilesByPubKey={publishedProfilesByPubKey}
			on:viewauthor={(e)=>{pageInfo={viewauthor: e.detail, page: "posts_replies"}}} 
			/>
		</span>
	</span>
	
	<!-- <h1>Kinds</h1><p>{kinds}</p> -->
</section>
{/if}

<style>
	
</style>