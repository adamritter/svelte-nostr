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

export async function showEvent(event: any, pubKey:string, privKey:string) {
    if (event[0]=="EOSE") {
            console.log( "receive end of subscription event message", ...event);
            return;
    }
    if (event[0]=="NOTICE") {
            console.error( "receive notice event message", ...event);
            return;
    }
    let kind = event[2].kind;
    console.log("receive event kind=", kind, ...event);
    if ( kind == 4 ) {
            if (event[2].pubkey == pubKey) {
                    console.log("Direct message: kind == 4, from self")
            } else {
                    console.log("Direct message: kind == 4, from other")
            }
            var i; for ( i=0; i<event[ 2 ].tags.length; i++ ) {
                            if ( event[ 2 ].tags[ i ] && event[ 2 ].tags[ i ][ 1 ] ) {
                                            var recipient = event[ 2 ].tags[ i ][ 1 ];
                                            if ( recipient == pubKey ) {
                                                    console.log("Direct message tag to self",
                                                    await nip04.decrypt( privKey, event[ 2 ].pubkey, event[ 2 ].content ),
                                                        " (sent privately by " + event[ 2 ].pubkey + ")")
                                            } else if ( event[ 2 ].pubkey == pubKey ) {
                                                    console.log("Direct message tag from self to other",
                                                    await nip04.decrypt( privKey, recipient, event[ 2 ].content ),
                                                        " (sent privately by " + event[ 2 ].pubkey + ")")
                                            }
                            }
            }
    } else if (kind == 1 ) {
            if (event[2].pubkey == pubKey) {
                    console.log("Public message: kind == 1, from self")
            } else {
                    console.log("Public message: kind == 1, from other")
            }
            console.log(event[ 2 ].content + " (sent publicly by " + event[ 2 ].pubkey + ")")
    } else if(kind == 0) {
            console.log("kind=0, set metadata to ", JSON.parse(event[2].content))
    } else if(kind==3) {
            console.log("kind=3, contact list length:", event[2].tags.length)
    } else {
            console.log("unknown kind", kind)
    }
}

export enum Kind {
    Profile = 0,
    PublicNote = 1,
    Contacts = 3,
    DirectMessage = 4,
    Reaction = 7
}


export function sortByCreatedAt(events:Array<any>) {
    return [...events].sort((a:any,b:any)=>(b.created_at - a.created_at))
}