<script>
  import Profile from "./Profile.svelte";
  export let contacts;
  export let profilesByPubKey = {};
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();
  import Photo from "./Photo.svelte";
</script>

<h1>Followed</h1>
{#each contacts as contact}
  <div on:click={() => dispatch("viewauthor", contact)}>
    <Photo
      data={profilesByPubKey.get(contact)}
      on:click={() => dispatch("viewauthor", contact)}
    />
    <Profile data={profilesByPubKey.get(contact)} pubkey={contact} />
  </div>
{/each}
