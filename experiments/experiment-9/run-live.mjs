import { resolveName } from "./resolver.mjs";

const name = process.argv[2];
if (!name) throw new Error("usage: node run-live.mjs <name>");

console.log(JSON.stringify(await resolveName(name), null, 2));
