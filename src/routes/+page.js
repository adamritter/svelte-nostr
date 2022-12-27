// since there's no dynamic data here, we can prerender
// it so that it gets served as a static asset in production
export const prerender = false;
export const ssr = false;
import { readPrivateKey, readPublicKey } from '../lib/browser-key-manager';


export async function load() {
    return {pubkey: await readPublicKey(), private_key: readPrivateKey()};
}