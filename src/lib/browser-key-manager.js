// For some reason this line doesn't work as NodeJS tries to import the module as CommonJS
// import {getPublicKey, nip19} from 'nostr-tools'
import * as pkg from 'nostr-tools';
const { nip19, getPublicKey } = pkg;

export function readPrivateKey() {
    let privKey = localStorage.getItem("private_key")
    if(privKey && privKey.slice(0, 4)=="nsec") {
        let {data} = nip19.decode(privKey)
        privKey=data;
    }
    return privKey;
}

export async function readPublicKey() {
	let privKey = readPrivateKey()
    if(privKey) {
        return getPublicKey(privKey, true);
    } else {
        return await window.nostr.getPublicKey();
    }
}
