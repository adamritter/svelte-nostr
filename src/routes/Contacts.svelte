<script>
    import Profile from "./Profile.svelte";
    export let contacts;
    export let profilesByPubKey={};
</script>

<h1>Followed</h1>
{#each contacts as contact}
    <div><Profile data={profilesByPubKey[contact]} pubkey={contact} /></div>
{/each}