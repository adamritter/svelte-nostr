import{_ as a}from"./preload-helper-41c905a7.js";import{p as i}from"./nostr.esm-d2518f25.js";const{nip19:n,getPublicKey:s}=i;function r(){let e=localStorage.getItem("private_key");if(e&&e.slice(0,4)=="nsec"){let{data:t}=n.decode(e);if(typeof t!="string")return null;e=t}return e}async function u(){let e=r();return e?s(e):window.nostr?await window.nostr.getPublicKey():null}const p=!1,c=!1;async function f(){let e=await u(),t=null;if(e){let{getFollowed:o}=await a(()=>import("./svelte-nostr-stores-22efceec.js").then(l=>l.k),["./svelte-nostr-stores-22efceec.js","./nostr.esm-d2518f25.js","./index-fd964354.js","./index-c4e02523.js"],import.meta.url);t=await o(e)}return{pubkey:e,followed:t,private_key:r()}}const y=Object.freeze(Object.defineProperty({__proto__:null,prerender:p,ssr:c,load:f},Symbol.toStringTag,{value:"Module"}));export{y as _,f as l,p,c as s};
