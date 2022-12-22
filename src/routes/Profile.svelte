<script>
    export let data;
    export let pubkey=null;
</script>

{#if data}
{@const content=JSON.parse(data.content)}
{#if content.display_name}<b>{content.display_name}</b>{/if} @{content.name}
{:else if pubkey}
  {pubkey.substr(0, 4)}...
{:else}
    [Unknown contact]
{/if}