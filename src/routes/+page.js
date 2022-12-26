// since there's no dynamic data here, we can prerender
// it so that it gets served as a static asset in production
export const prerender = true;
export const ssr = false;
import {getPublicKey, nip19} from 'nostr-tools'


function getPrivKey() {
    let privKey = localStorage.getItem("private_key")
    if(privKey && privKey.slice(0, 4)=="nsec") {
        let {data} = nip19.decode(privKey)
        privKey=data;
    }
    return privKey;
}
async function readPublicKey() {
	let privKey = getPrivKey()
    if(privKey) {
        return getPublicKey(privKey, true);
    } else {
        return await window.nostr.getPublicKey();
    }
}

export async function load() {
    return {pubkey: await readPublicKey(), private_key: getPrivKey()};
}