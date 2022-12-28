<script>
	import {getEventsByFilter, db} from '$lib/subscription'
	import Profile from './Profile.svelte'
	import DMs from './DMs.svelte'
	import Contacts from './Contacts.svelte';
	import PublicNotes from './PublicNotes.svelte';
	import {publishedStore, receivedStore, publishedProfilesStore, publishedProfilesByPubKeyStore,
		contactsStore, eventsFromFollowedStore, subscribeAndCacheResultsStore} from '$lib/svelte-nostr-stores'
	export let data;

	let pubKey = data.pubkey;
	console.log("pub key:", pubKey)
	let published=publishedStore(pubKey)
	let received=receivedStore(pubKey)
	$: kinds=$published.map(author => author.kind)
	let published_profiles=publishedProfilesStore(published, pubKey)
	let contacts=contactsStore(published)
	let publishedProfilesByPubKey=publishedProfilesByPubKeyStore(published_profiles)
	let eventsFromFollowed=eventsFromFollowedStore(contacts)
	let page="posts"

	// Debug
	$: document.publishedProfilesByPubKey=$publishedProfilesByPubKey
	document.subscribeAndCacheResultsStore=subscribeAndCacheResultsStore
	document.getEventsByFilter=getEventsByFilter
	document.db=db;
	$: document.received=$received
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>


<section>
	<a href="#" on:click={()=>page="posts"}><b>Posts</b></a>
	<a href="#" on:click={()=>page="posts_replies"}><b>Posts and replies</b></a>
	<a href="#" on:click={()=>page="contacts"}><b>Contacts</b></a>
	<a href="#" on:click={()=>page="dms"}><b>DMs</b></a>

	<!--  5: event deletion, 6???, 7: reaction-->
	<Profile data={$publishedProfilesByPubKey[pubKey]} pubkey={pubKey} />
	<span style="display: flex; gap: 20px; flex-direction: row">
		<span style:display={(page=="posts") ? "block" : "none"}><PublicNotes only_posts=true events={$published.concat($received).concat($eventsFromFollowed)} profilesByPubKey={$publishedProfilesByPubKey} /></span>
		<span style:display={(page=="posts_replies") ? "block" : "none"}><PublicNotes events={$published.concat($received).concat($eventsFromFollowed)} profilesByPubKey={$publishedProfilesByPubKey} /></span>
		{#if data.private_key} <!-- TODO: use window.nostr encode / decode instead if the private key doesn't exist -->
		<span style:display={(page=="dms") ? "block" : "none"}><DMs events={$published.concat($received)} privKey={data.private_key} pubKey={pubKey} profilesByPubKey={$publishedProfilesByPubKey} /></span>
		{/if}
		<span style="flex-basis: 500px; display: block"><Contacts contacts={$contacts} profilesByPubKey={$publishedProfilesByPubKey} /></span>
	</span>
	
	<!-- <h1>Kinds</h1><p>{kinds}</p> -->
</section>

<style>
	
</style>
