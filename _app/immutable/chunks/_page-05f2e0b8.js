import{p as n}from"./nostr.esm-d2518f25.js";const{nip19:a,getPublicKey:i}=n;function r(){let e=localStorage.getItem("private_key");if(e&&e.slice(0,4)=="nsec"){let{data:t}=a.decode(e);if(typeof t!="string")return null;e=t}return e}async function o(){let e=r();return e?i(e):window.nostr?await window.nostr.getPublicKey():null}const l=!1,s=!1;async function c(){return{pubkey:await o(),private_key:r()}}const p=Object.freeze(Object.defineProperty({__proto__:null,prerender:l,ssr:s,load:c},Symbol.toStringTag,{value:"Module"}));export{p as _,c as l,l as p,s};