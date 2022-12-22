<script>
    export let data;
    export let pubkey=null;
</script>

{#if data}
{@const content=JSON.parse(data.content)}
{#if content.picture}
<img src={content.picture} title={content.about + "\n" + data.pubkey} width="40px" height="40px" style="border-radius: 50%"/>
{/if}
{/if}