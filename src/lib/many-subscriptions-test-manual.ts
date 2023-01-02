/* eslint-env jest */

require('websocket-polyfill')
import { relayInit, type Event, type Relay } from "nostr-tools";
import { allRelays } from "./subscription";
import {format as prettyFormat} from "pretty-format";

let connected_relays:Map<string,Relay> = new Map();
async function tryConnect(url:string) {
    let relay=relayInit(url);
    let result="no_connect"
    relay.on("connect", () => {
        connected_relays.set(url, relay)
        result="connected"
    })
    relay.on("error", (err) => {
        result="error"
    })
    await relay.connect();
    return result
}

async function gatherData<T>(data:Map<string, Array<any>>, urls:string[], func:(arg:string)=>Promise<T>, timeout:number) {
    let towait = [];
    let gathered:{url?: string, result:T, time: number}[] = [];
    for (let i = 0; i < urls.length; i++) {
        let url=urls[i];
        towait.push(new Promise((res) => {
            let time=Date.now();
            func(url).then((result:T) => {
                gathered.push({url, result, time: Date.now()-time})
            })
        }));
    }
    await Promise.race([Promise.allSettled(towait), new Promise((res) => setTimeout(res, timeout))]);
    for(let url of urls) {
        if(!data.has(url)) {
            data.set(url, []);
        }
        let found=gathered.find((item) => item.url===url);
        if(found) {
            delete found.url
            data.get(url)?.push(found);
        } else {
            data.get(url)?.push({result: "timeout", time: timeout});
        }
    }
}

async function subTest(url:string) {
    let relay=connected_relays.get(url);
    if(!relay) {
        return "no_relay"
    }
    // let id="8c194f4477cbd1fe1a77483faff552afef3ecfb7a1615739354d1624d924709c"
    let id="41ce9bc50da77dda5542f020370ecc2b056d8f2be93c1cedf1bf57efcab095b0"
    let result="timeout";
    let sub=relay.sub([{ids:[id]}])
    sub.on("event", (event:Event) => {
        result="event"
    })
    let eosePromise=new Promise((res) => {
        sub.on("eose", () => {
            if(result!="event") {
                result="eose"
            }
            res(0);
        })
    })
    await Promise.race([new Promise((res) => setTimeout(res, 2000)), eosePromise]);
    return result;
}

test("many subscriptions", async () => {
    let data=new Map();
    await gatherData(data, allRelays, tryConnect, 2000);
    for(let i=0; i<10; i++) {
        await gatherData(data, Array.from(connected_relays.keys()), subTest, 2500);
    }
    console.log((data));
});