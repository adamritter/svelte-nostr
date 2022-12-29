<script>
	import {getEventsByFilter} from '$lib/db'
	import Profile from './Profile.svelte'
	import DMs from './DMs.svelte'
	import Contacts from './Contacts.svelte';
	import PublicNotes from './PublicNotes.svelte';
	import Photo from './Photo.svelte';
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
	let viewauthor;
	let page="posts"

	// Debug
	$: document.publishedProfilesByPubKey=$publishedProfilesByPubKey
	document.subscribeAndCacheResultsStore=subscribeAndCacheResultsStore
	document.getEventsByFilter=getEventsByFilter
	$: document.received=$received
	$: mainPageEvents = $published.concat($received).concat($eventsFromFollowed)
	$: viewAuthorStore = viewauthor ? publishedStore(viewauthor) : null;
	$: pageEvents = (viewauthor) ? ((viewauthor==pubKey) ? $published : $viewAuthorStore) : mainPageEvents
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>


<section>
	<a href="#" on:click={()=>{page="posts"; viewauthor=null}}><b>Posts</b></a>
	<a href="#" on:click={()=>{page="posts_replies"; viewauthor=null}}><b>Posts and replies</b></a>
	<a href="#" on:click={()=>page="contacts"}><b>Contacts</b></a>
	<a href="#" on:click={()=>page="dms"}><b>DMs</b></a>

	<!--  5: event deletion, 6???, 7: reaction-->
	<span>
	<Photo data={$publishedProfilesByPubKey[pubKey]}
		on:click={()=>viewauthor=pubKey} />
	<Profile data={$publishedProfilesByPubKey[pubKey]} pubkey={pubKey} />
	</span>
	<span style="display: flex; gap: 20px; flex-direction: row">
		<span style:display={(page=="posts") ? "block" : "none"}>
			<PublicNotes only_posts=true events={pageEvents}
				profilesByPubKey={$publishedProfilesByPubKey}
				on:viewauthor={(e)=>{viewauthor=e.detail; page="posts_replies"}}/></span>
		<span style:display={(page=="posts_replies") ? "block" : "none"}>
			<PublicNotes events={pageEvents}
				profilesByPubKey={$publishedProfilesByPubKey}
				on:viewauthor={(e)=>{viewauthor=e.detail; page="posts_replies"}} />
		</span>
		{#if data.private_key} <!-- TODO: use window.nostr encode / decode instead if the private key doesn't exist -->
		<span style:display={(page=="dms") ? "block" : "none"}><DMs events={$published.concat($received)} privKey={data.private_key} pubKey={pubKey} profilesByPubKey={$publishedProfilesByPubKey} /></span>
		{/if}
		<span style="flex-basis: 500px; display: block">
			<Contacts contacts={$contacts} profilesByPubKey={$publishedProfilesByPubKey}
			on:viewauthor={(e)=>{viewauthor=e.detail; page="posts_replies"}} 
			/>
		</span>
	</span>
	
	<!-- <h1>Kinds</h1><p>{kinds}</p> -->
</section>

<style>
	
</style>
