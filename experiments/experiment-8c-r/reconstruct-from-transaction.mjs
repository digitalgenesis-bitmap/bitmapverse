import { createHash } from "node:crypto";

const OP_IF = 0x63;
const OP_ENDIF = 0x68;
const PROTOCOL_ID = Buffer.from("ord", "ascii");

function encodeVarInt(value) {
  if (value < 0xfd) return Buffer.from([value]);
  if (value <= 0xffff) {
    const encoded = Buffer.alloc(3);
    encoded[0] = 0xfd;
    encoded.writeUInt16LE(value, 1);
    return encoded;
  }
  throw new RangeError("fixture parser only serializes compact sizes through uint16");
}

function parseTransaction(rawHex) {
  const bytes = Buffer.from(rawHex, "hex");
  if (bytes.length === 0 || bytes.toString("hex") !== rawHex.toLowerCase()) {
    throw new TypeError("raw transaction must be canonical hexadecimal bytes");
  }

  let cursor = 0;
  const read = (length) => {
    if (cursor + length > bytes.length) throw new RangeError("truncated transaction");
    const value = bytes.subarray(cursor, cursor + length);
    cursor += length;
    return value;
  };
  const readVarInt = () => {
    const prefix = read(1)[0];
    if (prefix < 0xfd) return prefix;
    if (prefix === 0xfd) return read(2).readUInt16LE();
    throw new RangeError("fixture parser only accepts compact sizes through uint16");
  };

  const version = read(4);
  const marker = read(1)[0];
  const flag = read(1)[0];
  if (marker !== 0 || flag !== 1) throw new TypeError("fixture must be a serialized SegWit transaction");

  const inputs = [];
  const inputCount = readVarInt();
  for (let index = 0; index < inputCount; index += 1) {
    const previousTxid = read(32);
    const previousVout = read(4);
    const scriptSig = read(readVarInt());
    const sequence = read(4);
    inputs.push({ previousTxid, previousVout, scriptSig, sequence, witness: [] });
  }

  const outputs = [];
  const outputCount = readVarInt();
  for (let index = 0; index < outputCount; index += 1) {
    const value = read(8);
    const scriptPubKey = read(readVarInt());
    outputs.push({ value, scriptPubKey });
  }

  for (const input of inputs) {
    const itemCount = readVarInt();
    for (let index = 0; index < itemCount; index += 1) {
      input.witness.push(read(readVarInt()));
    }
  }

  const locktime = read(4);
  if (cursor !== bytes.length) throw new TypeError("unexpected trailing transaction bytes");

  const stripped = [version, encodeVarInt(inputs.length)];
  for (const input of inputs) {
    stripped.push(
      input.previousTxid,
      input.previousVout,
      encodeVarInt(input.scriptSig.length),
      input.scriptSig,
      input.sequence,
    );
  }
  stripped.push(encodeVarInt(outputs.length));
  for (const output of outputs) {
    stripped.push(output.value, encodeVarInt(output.scriptPubKey.length), output.scriptPubKey);
  }
  stripped.push(locktime);

  const firstHash = createHash("sha256").update(Buffer.concat(stripped)).digest();
  const txid = Buffer.from(createHash("sha256").update(firstHash).digest()).reverse().toString("hex");

  return { version: version.readUInt32LE(), inputs, outputs, locktime: locktime.readUInt32LE(), txid };
}

function tapscriptFromWitness(witness) {
  if (witness.length < 2) return null;
  const hasAnnex = witness.at(-1)?.[0] === 0x50;
  const controlBlockPosition = witness.length - (hasAnnex ? 2 : 1);
  const scriptPosition = controlBlockPosition - 1;
  if (scriptPosition < 0) return null;
  return witness[scriptPosition];
}

function parseInstructions(script) {
  const instructions = [];
  for (let cursor = 0; cursor < script.length; ) {
    const opcode = script[cursor++];
    if (opcode === 0) {
      instructions.push({ kind: "push", data: Buffer.alloc(0) });
    } else if (opcode <= 75) {
      if (cursor + opcode > script.length) throw new RangeError("truncated direct push");
      instructions.push({ kind: "push", data: script.subarray(cursor, cursor + opcode) });
      cursor += opcode;
    } else if (opcode === 76) {
      if (cursor >= script.length) throw new RangeError("truncated OP_PUSHDATA1");
      const length = script[cursor++];
      if (cursor + length > script.length) throw new RangeError("truncated OP_PUSHDATA1 body");
      instructions.push({ kind: "push", data: script.subarray(cursor, cursor + length) });
      cursor += length;
    } else {
      instructions.push({ kind: "op", opcode });
    }
  }
  return instructions;
}

function envelopesFromTapscript(tapscript, input) {
  const instructions = parseInstructions(tapscript);
  const envelopes = [];

  for (let cursor = 0; cursor < instructions.length; cursor += 1) {
    const start = instructions[cursor];
    if (start.kind !== "push" || start.data.length !== 0) continue;
    if (instructions[cursor + 1]?.kind !== "op" || instructions[cursor + 1].opcode !== OP_IF) continue;
    const protocol = instructions[cursor + 2];
    if (protocol?.kind !== "push" || !protocol.data.equals(PROTOCOL_ID)) continue;

    const payload = [];
    let end = cursor + 3;
    for (; end < instructions.length; end += 1) {
      const instruction = instructions[end];
      if (instruction.kind === "op" && instruction.opcode === OP_ENDIF) break;
      if (instruction.kind !== "push") {
        end = instructions.length;
        break;
      }
      payload.push(instruction.data);
    }
    if (end >= instructions.length) continue;

    const bodyMarker = payload.findIndex((push, position) => position % 2 === 0 && push.length === 0);
    const body = bodyMarker === -1 ? null : Buffer.concat(payload.slice(bodyMarker + 1));
    envelopes.push({ input, offset: envelopes.length, bodyHex: body?.toString("hex") ?? null });
    cursor = end;
  }

  return envelopes;
}

export function reconstructInscriptions(rawHex) {
  const transaction = parseTransaction(rawHex);
  const envelopes = [];
  for (let input = 0; input < transaction.inputs.length; input += 1) {
    const tapscript = tapscriptFromWitness(transaction.inputs[input].witness);
    if (tapscript) envelopes.push(...envelopesFromTapscript(tapscript, input));
  }

  return {
    transaction,
    inscriptions: envelopes.map((envelope, index) => ({
      ...envelope,
      index,
      inscriptionId: `${transaction.txid}i${index}`,
    })),
  };
}
