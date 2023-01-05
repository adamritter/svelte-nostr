// since there's no dynamic data here, we can prerender
// it so that it gets served as a static asset in production
export const prerender = false;
export const ssr = false;
import { readPrivateKey, readPublicKey } from '../lib/browser-key-manager';


export async function load() {
    let pubkey= await readPublicKey();
    let followed=null;
    if(pubkey) {
        let {getFollowed}=await import('../lib/svelte-nostr-stores')
        followed=await getFollowed(pubkey, {offline: false})
    }
    return {pubkey, followed, private_key: readPrivateKey()};
}