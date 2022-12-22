const putAtEnd=true;  // Wait for EOSE to put new events in the store
const neverSend=true;  // Turn off data requests to the relay

import Dexie from 'dexie';
import { normalizeRelayURL } from './nostr-helpers';
function getDB() {
    const db = new Dexie("nostr_events", {chromeTransactionDurability: "relaxed"});
    db.version(1).stores({
            events: "++,filter"
    });
    return db;
}
export let db=getDB();

function splitWhereCaluseBy(filter, key) {
    if (key) {
        if(filter[key] && filter[key].length > 1) {
            filter[key].map(p => console.log("example", JSON.stringify({...filter, [key]: [p]})))
            return db.events.where("filter").anyOf(filter[key].map(p => JSON.stringify({...filter, [key]: [p]})));
        } else {
            return null;
        }
    } else {
        console.log("exact search", JSON.stringify(filter))
        return db.events.where("filter").equals(JSON.stringify(filter));
    }
}

// Exported only for debugging
export function getEventsByFilter(filter) {
    filter={...filter}
    delete filter.limit
    let timeLabel="getEventsByFilter "+JSON.stringify(filter);
    console.time(timeLabel);
    let filtered=splitWhereCaluseBy(filter, "authors") ||
        splitWhereCaluseBy(filter, "ids") ||
        splitWhereCaluseBy(filter, "#p") ||
        splitWhereCaluseBy(filter, "#e") ||
        splitWhereCaluseBy(filter, null);
    return filtered.toArray()
            .then(events => {
                    let r=events.map(event => (event.event || event.events || [])).flat()
                    console.timeLog(timeLabel, "got "+events.length+" events, returning "+r.length+" events");
                    console.timeEnd(timeLabel)
                    return r;
            });
}

function addToPutBy(toPut, filter, key, event, eventKey, isTag) {
    if(key) {
        if(filter[key] && filter[key].length > 1) {
            for(let value of filter[key]) {
                if(isTag) {
                    for(let tag of event.tags) {
                        if(tag[0] == eventKey) {
                            if(tag[1] === value) {
                                addToPut(toPut, {...filter, [key]: [value]}, event);
                                break;
                            }
                        }
                    }
                } else if(event[eventKey] === value) {
                    addToPut(toPut, {...filter, [key]: [value]}, event);
                    break;
                }
            }
            return true;
        }
        return false;
    } else {
        addToPut(toPut, filter, event);
    }
}

function addToPut(toPut, filter, event) {
    let jsonFilter=JSON.stringify(filter)
    if(toPut.has(jsonFilter)) {
        toPut.get(jsonFilter).push(event);
    } else {
        toPut.set(jsonFilter, [event]);
    }
}

// Implement batching
function putEvents(filter, events, batchSize=30) {
    filter={...filter}
    delete filter.limit

    let toPut = new Map();
    
    for (let event of events) {
        addToPutBy(toPut, filter, "authors", event, "pubkey", false) ||
         addToPutBy(toPut, filter, "ids", event, "ids", false) ||
         addToPutBy(toPut, filter, "#p", event, "p", true) ||
         addToPutBy(toPut, filter, "#e", event, "e", true) ||
         addToPutBy(toPut, filter, null, event);
    }
    let toPutArray=[];
    // Implement batching
    for(let [filter, events] of toPut) {
        events=events.sort((a,b) => a.created_at - b.created_at);
        for(let i=0; i<events.length; i+=batchSize) {
            if(batchSize > 1 || events.length==1) {
                toPutArray.push({
                    filter: filter,
                    events: events.slice(i, i+batchSize)
                })
            } else {
                toPutArray.push({
                    filter: filter,
                    event: events[i]
                })
            }
        }
    }

    return db.events.bulkPut(toPutArray)
}


let subscriptions=new Map();
let subscriptionId=0;

// Registry: https://nostr-registry.netlify.app/
let relay = "wss://nostr-relay.wlvs.space";
relay = "wss://relay.damus.io"
relay = "wss://nostr.fmt.wiz.biz"
relay = normalizeRelayURL( relay );
export let socket = new WebSocket( relay );

function containsId(events, id) {
    for(let event of events) {
        if(event.id == id) {
            return true;
        }
    }
    return false;
}


// Listen for messages
socket.addEventListener('message', function( message ) {
    console.log("got message", message)
        var event = JSON.parse( message.data );
        // showEvent(event);
        if(event[0]=="EVENT") {
                let subText=event[1]
                let subscription=subscriptions[subText]
                if(subscription) {
                        if(!containsId(subscription.events, event[2].id)) {
                                subscription.changed=true;
                                subscription.events.push(event[2])
                                
                                if (subscription.eose) {
                                    putEvents(subscription.filter, [event[2]])
                                    
                                    console.time("callback")
                                    subscription.callback(subscription.events);
                                    console.timeEnd("callback")
                                } else {
                                    if(!putAtEnd) {
                                        putEvents(subscription.filter, [event[2]])
                                    } else {
                                        subscription.newEvents.push(event[2])
                                    }
                                }
                        }
                       
                }
        }
        // 1 relay???
        if (event[0]=="EOSE") {
                let subText=event[1]
                let subscription=subscriptions[subText]
                if(subscription) {
                    console.timeLog(subscription.label, "EOSE with "+subscription.events.length+
                        " events, from that "+subscription.newEvents.length+" new");
                    console.timeEnd(subscription.label);
                    if(subscription.newEvents.length > 0) {
                        putEvents(subscription.filter, subscription.newEvents)
                        subscription.newEvents=[]
                    }
                }
                if(!subscription || subscription.autoClose) {
                        socket.send(JSON.stringify(["CLOSE", subText]))
                        delete subscriptions[subText]
                }
                if(subscription && subscription.changed) {
                    subscription.callback(subscription.events);
                }
                if (subscription) {
                    subscription.eose=true;
                }
        }
});
let send_on_open=[]
socket.addEventListener('open', function() {
        for(let i=0; i<send_on_open.length; i++) {
                socket.send(send_on_open[i])
        }
        send_on_open.length=0
});

function sendOnOpen(data) {
        if(socket.readyState==1) {
                socket.send(data)
        } else {
                send_on_open.push(data)
        }
}

const matchImpossible=(filter)=>(filter.ids && filter.ids.length == 0) || (filter.authors && filter.authors.length == 0);

// put queried at, max timestamp, min timestamp (min timestamp is 0 if there was no limit reached) in database
// Big: support for multiple relays (logging queries can help)
// message verification: should it use nostr-tools library?

// Returns unsubscribe function, calls back with array of events.
// It may call back multiple times (first from cached results, then updated results)
// It stores results in indexedDB and returns with cached results first if there is match.
// options:
//  onlyOne: return only one result
//  autoClose: close subscription after first result

export function subscribeAndCacheResults(filter, callback, options={}) {
    if (filter.ids) {
        options.onlyOne=true;
    }
    let label=JSON.stringify(filter);
    console.time(label);
    console.log("filter", filter)
    if(matchImpossible(filter)) {
        console.log("empty filter", filter)
        return ()=>{}
    }
    let filter2={...filter};
    let subText="sub"+subscriptionId
    subscriptionId=subscriptionId+1
    subscriptions[subText]={events: [], callback, filter, changed: false, options, label, newEvents: []}
    
    getEventsByFilter(filter).then((events)=>{
            let num_events=events.length;
            console.timeLog(label, `got ${num_events} indexedDB events for filter`);
            let subscription=subscriptions[subText]
            if(subscription) {
                    if(events.length) {
                        subscription.events=events;
                        subscription.callback(events)
                    }
                    let needSend=true;
                    if(options.onlyOne) {
                        if(filter2.ids) {
                            filter2.ids=filter2.ids.filter((id)=>!events.find((event)=>event.id==id))
                            if(!filter2.ids.length) {
                                needSend=false;
                            }
                        } else if(filter2.authors) {
                            filter2.authors=filter2.authors.filter((author)=>!events.find((event)=>event.pubkey==author))
                            if(!filter2.authors.length) {
                                needSend=false;
                            }
                        } else {
                            throw new Error("onlyOne option not supported for this filter", filter2)
                        }
                    }
                    if (neverSend) {
                        needSend=false;
                    }
                    if(needSend) {
                        console.log("sending subscription REQ", subText, filter2, ", original label", label)
                        sendOnOpen(JSON.stringify(["REQ", subText, filter2]));
                    } else {
                        console.timeLog(label, 'no need to send subscription');
                        console.timeEnd(label);
                    }
            }
    })
    return ()=>{
            if(subscriptions[subText]) {
                    delete subscriptions[subText]
                    sendOnOpen(JSON.stringify(["CLOSE", subText]));
            }
    }
}

