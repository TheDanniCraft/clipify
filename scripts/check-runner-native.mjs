import { Entry } from "@napi-rs/keyring";
if (typeof Entry !== "function") throw new Error("The native @napi-rs/keyring binding did not load");
console.log(`[Runner] Native keyring binding loaded on ${process.platform}-${process.arch}`);
