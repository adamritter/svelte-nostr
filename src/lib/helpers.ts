import {nip04, getPublicKey} from 'nostr-tools'

export function normalizeRelayURL(e:string){
    let[t,...r]=e.trim().split("?");return"http"===t.slice(0,4)&&(t="ws"+t.slice(4)),"ws"!==t.slice(0,2)&&(t="wss://"+t),t.length&&"/"===t[t.length-1]&&(t=t.slice(0,-1)),[t,...r].join("?")
}

export async function decryptDM(privKey: string, pubKey: string, dm: any) {
    if (dm.pubkey===pubKey) {
        return nip04.decrypt( privKey, dm.tags[0][1], dm.content)
    } else {
        return nip04.decrypt(privKey, dm.pubkey, dm.content)
    }
}

export function sortByCreatedAt(events:Array<any>) {
    return [...events].sort((a:any,b:any)=>(b.created_at - a.created_at))
}