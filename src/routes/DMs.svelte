<script>
    import {groupBy} from "$lib/collection-helpers";
    import {decryptDM} from "$lib/nostr-helpers";
    import {sortByCreatedAt} from "$lib/nostr-helpers";
    import Profile from "./Profile.svelte";
    export let events;
    export let privKey;
    export let pubKey;
    export let currentOtherPartyPubKey=null;
    export let profilesByPubKey={};
    let isDM=(event) => event.kind === 4;
    let getOtherPartyPubKey=(event)=>(pubKey==event.pubkey) ? event.tags.find(tag=>tag[0]=="p")[1] : event.pubkey;
    $: dmsByOtherPartyPubKey = groupBy(events.filter(isDM), getOtherPartyPubKey);
</script>
<h1>Direct messages</h1>
<span style="display: flex; gap: 40px">
<span>
{#each Object.keys(dmsByOtherPartyPubKey) as otherPartyPubKey}
    <div>
        <Profile data={profilesByPubKey[otherPartyPubKey]} pubkey={otherPartyPubKey} on:click={()=>currentOtherPartyPubKey=otherPartyPubKey} />
            <a on:click={()=>currentOtherPartyPubKey=otherPartyPubKey}>See DMs</a>
    </div>
{/each}
</span>

<span>

{#if currentOtherPartyPubKey && dmsByOtherPartyPubKey[currentOtherPartyPubKey]}
    <div>
        <Profile data={profilesByPubKey[currentOtherPartyPubKey]} pubkey={currentOtherPartyPubKey} />
    </div>
    {#each sortByCreatedAt(dmsByOtherPartyPubKey[currentOtherPartyPubKey]) as dm}
        <div>
            <Profile data={profilesByPubKey[dm.pubkey]} pubkey={dm.pubkey} />
            {#await decryptDM(privKey, pubKey, dm)}
            {:then decryptedDM}
                {decryptedDM}
            {/await}
        </div>
    {/each}
{/if}
</span>
</span>