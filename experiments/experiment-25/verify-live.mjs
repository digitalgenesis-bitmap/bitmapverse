import { readPrivateSignatures, verifyExperiment25 } from "./verifier.mjs";

const result = await verifyExperiment25({ signatures: await readPrivateSignatures() });
console.log(JSON.stringify(result, null, 2));
if (result.status !== "ACCEPT") process.exitCode = 1;
