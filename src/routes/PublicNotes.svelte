<script>
  import {embedMedia} from "./../lib/embed-media.js";
  import Profile from "./Profile.svelte";
  import Photo from "./Photo.svelte";
  import {sortByCreatedAt} from "$lib/helpers";
  import TimeAgo from "javascript-time-ago";
  import en from "javascript-time-ago/locale/en";
  import {Kind} from "nostr-tools";
  TimeAgo.addLocale(en);
  const timeAgo = new TimeAgo("en-US");
  import {createEventDispatcher} from "svelte";

  const dispatch = createEventDispatcher();

  export let events;
  export let profilesByPubKey;
  export let only_posts = false;
  export let eventsByEventRef;

  function only_post_filter(event) {
    return (
      event.kind === Kind.Text &&
      (only_posts ? event.tags.every((tag) => tag[0] !== "e") : true)
    );
  }
  $: publicNotes = sortByCreatedAt(events).filter(only_post_filter);
  $: document.publicNotes = publicNotes;
  $: document.events = events;
</script>

{#if only_posts}
  <h1>Posts</h1>
{:else}
  <h1>Posts & Replies</h1>
{/if}
<span style="display: flex; gap: 100px">
  <span>
    {#each publicNotes as publicNote}
      <span
        style="display: flex; gap: 10px; padding-bottom: 10px; padding-top: 10px "
      >
        <span style="flex-basis: 60px">
          <Photo
            data={profilesByPubKey.get(publicNote.pubkey)}
            on:click={() => dispatch("viewauthor", publicNote.pubkey)}
          /></span
        >
        <span
          style="border-bottom: 1px solid #eee; width: 75vw; overflow: hidden"
        >
          <Profile
            data={profilesByPubKey.get(publicNote.pubkey)}
            pubkey={publicNote.pubkey}
          />
          &nbsp;{timeAgo.format(publicNote.created_at * 1000, "twitter")}<br />
          {@html embedMedia(publicNote.content)}
          {#each publicNote.tags as tag}
            {#if tag[0] == "t"}
              <a on:click={() => 0}> #{tag[1]} </a>
            {/if}
            {#if tag[0] == "p"}
              <Profile data={profilesByPubKey.get(tag[1])} pubkey={tag[1]} />
            {/if}
          {/each}
          {#if eventsByEventRef && eventsByEventRef.get(publicNote.id)}
            <br /><br />Replies:<br />
            {#each eventsByEventRef.get(publicNote.id) as repliedTo}
              <br />
              <Profile
                data={profilesByPubKey.get(repliedTo.pubkey)}
                pubkey={repliedTo.pubkey}
              />
              &nbsp;{timeAgo.format(repliedTo.created_at * 1000, "twitter")}<br
              />
              <span style="padding-left: 3em">
                {@html embedMedia(repliedTo.content)}</span
              >
              <br /><br />
            {/each}
          {/if}
        </span>
      </span>
    {/each}
  </span>
</span>
