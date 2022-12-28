// For some reason this line doesn't work as NodeJS tries to import the module as CommonJS
// import {getPublicKey, nip19} from 'nostr-tools'
import * as pkg from 'nostr-tools';
const { nip19, getPublicKey } = pkg;

export function readPrivateKey() {
    let privKey:string|null = localStorage.getItem("private_key")
    if(privKey && privKey.slice(0, 4)=="nsec") {
        let {data} = nip19.decode(privKey)
        if(typeof(data) != "string") {
            return null;
        }
        privKey=data;
    }
    return privKey;
}

export async function readPublicKey() {
	let privKey = readPrivateKey()
    if(privKey) {
        return getPublicKey(privKey);
    } else {
        // @ts-ignore
        if(!window.nostr) {
            return null;
        }
        // @ts-ignore
        return await window.nostr.getPublicKey();
    }
}
