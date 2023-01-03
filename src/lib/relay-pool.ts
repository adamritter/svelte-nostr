import type { Event, Filter, Sub } from 'nostr-tools'
import {type Relay, relayInit} from './relay'
export class RelayPool {
    relayByUrl: Map<string, Relay>
    constructor(relays: string[]|undefined) {
        this.relayByUrl = new Map()
        if (relays) {
            for (let relay of relays) {
                this.addOrGetRelay(relay)
            }
        }
    }
    addOrGetRelay(relay: string) : Relay {
        let relayInstance = this.relayByUrl.get(relay)
        if(relayInstance) {
            return relayInstance
        }
        relayInstance = relayInit(relay)
        this.relayByUrl.set(relay, relayInstance)
        relayInstance.connect()
        return relayInstance
    }
  
    close() {
        for(let relayInstance of this.relayByUrl.values()) {
            relayInstance.close()
        }
        this.relayByUrl.clear()
    }
  
    sub(filters:Filter[], relays:string[]) {
        let subs=[]
        for (let relay of relays) {
            let instance=this.addOrGetRelay(relay)
            subs.push(instance.sub(filters))
        }
        return new RelayPoolSubscription(subs)
    }
  
    publish(event: Event, relays: string[]) {
        for (let relay of relays) {
            let instance=this.addOrGetRelay(relay)
            instance.publish(event)
        }
    }
    onnotice(cb: (msg: string)=>void) {
        this.relayByUrl.forEach((relay: Relay, url: string) => relay.on('notice', (msg: string)=>cb(url+': '+msg)))
    }
}

export class RelayPoolSubscription {
    subscriptions: Sub[]
    eventsBySub: Map<Sub, Event[]>
    constructor(subscriptions:Sub[]) {
        this.subscriptions = subscriptions
        this.eventsBySub = new Map()
    }
    onevent(cb: (event: Event, afterEose: boolean)=>void) : ()=>void {
        this.subscriptions.forEach(subscription => {
            this.eventsBySub.set(subscription, [])
            subscription.on('event', (event: Event)=>{
                let eventsByThisSub = this.eventsBySub.get(subscription)
                if(eventsByThisSub) {
                    eventsByThisSub.push(event)
                }
                cb(event, eventsByThisSub===undefined)
            })
        })
        return ()=>{
            this.subscriptions.forEach(subscription => subscription.off("event", cb))
        }
    }
    oneose(cb: (eventsByThisSub: Event[]|undefined)=>void) : ()=>void {
        this.subscriptions.forEach(subscription => subscription.on('eose', ()=>{
            let eventsByThisSub = this.eventsBySub.get(subscription)
            this.eventsBySub.delete(subscription)
            cb(eventsByThisSub)
        }))
        return ()=>{
            this.subscriptions.forEach(subscription => subscription.off("eose", cb))
        }
    }
    unsub() {
      this.subscriptions.forEach(subscription => subscription.unsub())
    }
}
