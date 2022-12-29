<script>
    export let data;
    export let pubkey=null;

    import { createEventDispatcher } from 'svelte';

const dispatch = createEventDispatcher();
</script>

{#if data}
{@const content=JSON.parse(data.content)}
{#if content.picture}
<img src={content.picture} title={content.about + "\n" + data.pubkey}
 width="40px" height="40px" style="border-radius: 50%"
 on:click={()=>dispatch('click', { pubkey: data.pubkey })}/>
 {:else}
 <span on:click={()=>dispatch('click', { pubkey: data.pubkey })} display="font-size: 10em">👤</span>
{/if}
{/if}