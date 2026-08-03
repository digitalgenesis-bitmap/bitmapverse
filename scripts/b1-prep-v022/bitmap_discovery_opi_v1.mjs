/**
 * Reference implementation of bitmap_discovery_opi_v1
 * (blind/v0.2.2/BITMAP_DISCOVERY_PROFILE.md, Capa 2), faithfully
 * reproducing the verified OPI source at commit
 * da24fb6cf4c2ef3f99d030ea2ef18ba9099b0633 — see
 * blind/v0.2.2/OPI_SOURCE_PROVENANCE.json for exact file/line citations.
 * Not shipped inside the blind package; kept here as the reference used
 * to build and check test-vectors/.
 *
 * Faithfulness notes on decoding strictness (these are NOT optional
 * conveniences — a lenient decoder here would silently accept content the
 * real OPI (Python codecs.decode + str.decode('utf-8'), both of which
 * raise on invalid input) would reject):
 *   - Node's Buffer.from(hex, "hex") is LENIENT: it silently stops at the
 *     first invalid byte pair instead of throwing. We validate the hex
 *     string with a strict regex first.
 *   - Node's Buffer#toString("utf8") is LENIENT: it substitutes U+FFFD
 *     for invalid byte sequences instead of throwing. We use
 *     TextDecoder("utf-8", { fatal: true }) instead, which throws on
 *     invalid UTF-8, matching Python's str.decode('utf-8') exactly.
 */

const STRICT_HEX = /^([0-9a-fA-F]{2})*$/;
const TEXT_PLAIN_HEX_PREFIX = "746578742f706c61696e"; // "text/plain"

export class BitmapDiscoveryError extends Error {}

/**
 * OPI_SOURCE_PROVENANCE.json: ord/db_reader/src/server.rs#L309-L323 (is_valid_bitmap).
 */
export function isValidBitmapCandidate({ inscriptionNumber, isJson, contentTypeHex }) {
  // Fail closed: inscription_number must be an actual integer to compare
  // against 0 at all. `undefined < 0` is `false` in JS (comparisons
  // against non-numbers never throw, they just yield false), which would
  // silently let a candidate missing inscription_number fall through to
  // the later checks instead of being rejected outright — exactly the
  // "ausencia de inscription_number bloquea el descubrimiento" failure
  // mode this function must guard against.
  if (!Number.isInteger(inscriptionNumber)) return false;
  if (inscriptionNumber < 0) return false;
  if (isJson) return false;
  if (!contentTypeHex.toLowerCase().startsWith(TEXT_PLAIN_HEX_PREFIX)) return false;
  return true;
}

/**
 * OPI_SOURCE_PROVENANCE.json: modules/bitmap_index/bitmap_index.py#L133-L147 (get_bitmap_number).
 * Returns the bitmap number as an integer, or null if the candidate is
 * not a valid bitmap number claim.
 */
export function getBitmapNumber(contentHex) {
  if (!STRICT_HEX.test(contentHex)) return null; // invalid hex — matches codecs.decode raising
  const bytes = Buffer.from(contentHex, "hex");
  let content;
  try {
    content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null; // invalid UTF-8 — matches .decode('utf-8') raising
  }
  if (!content.endsWith(".bitmap")) return null;
  content = content.slice(0, -".bitmap".length);
  if (content.length === 0) return null;
  for (const ch of content) {
    const code = ch.codePointAt(0);
    if (code > "9".codePointAt(0) || code < "0".codePointAt(0)) return null;
  }
  if (content[0] === "0" && content.length !== 1) return null;
  return Number.parseInt(content, 10);
}

/**
 * OPI_SOURCE_PROVENANCE.json: modules/bitmap_index/bitmap_index.py#L203-L205.
 */
export function isBlockExisting(bitmapNumber, blockHeight) {
  return bitmapNumber <= blockHeight;
}

/**
 * Simulates OPI's first-valid-claim-wins indexing for a single block
 * (bitmap_index.py#L196-L214, fed by server.rs#L727's inscription_number
 * sort). `candidates` must already be pre-filtered to this one block, and
 * is defensively re-sorted here by inscription_number ascending (the
 * server-side guarantee is not re-derived — this only makes the ordering
 * dependency explicit and testable).
 *
 * Each candidate: { inscriptionId, inscriptionNumber, contentHex, isJson,
 * contentTypeHex, blockHeight }.
 *
 * Returns a Map<bitmapNumber, candidate> of claims accepted in THIS block
 * (the caller is responsible for merging across blocks in ascending
 * block_height order and respecting cross-block first-claim-wins, since
 * that requires state carried across calls).
 */
export function indexBlockCandidates(candidates) {
  const sorted = [...candidates].sort((a, b) => a.inscriptionNumber - b.inscriptionNumber);
  const claims = new Map();
  for (const candidate of sorted) {
    if (
      !isValidBitmapCandidate({
        inscriptionNumber: candidate.inscriptionNumber,
        isJson: candidate.isJson,
        contentTypeHex: candidate.contentTypeHex,
      })
    ) {
      continue;
    }
    const bitmapNumber = getBitmapNumber(candidate.contentHex);
    if (bitmapNumber === null) continue;
    if (!isBlockExisting(bitmapNumber, candidate.blockHeight)) continue;
    if (claims.has(bitmapNumber)) continue; // ON CONFLICT (bitmap_number) DO NOTHING
    claims.set(bitmapNumber, { ...candidate, bitmapNumber });
  }
  return claims;
}

/**
 * Merges per-block claim maps across multiple blocks, processed in
 * ascending block_height order, respecting first-claim-wins across block
 * boundaries too (bitmap_index.py's ON CONFLICT applies globally across
 * the whole `bitmaps` table, not just within one block).
 */
export function indexBlocksInOrder(blocksAscending) {
  const global = new Map();
  for (const candidates of blocksAscending) {
    const claims = indexBlockCandidates(candidates);
    for (const [bitmapNumber, claim] of claims) {
      if (global.has(bitmapNumber)) continue;
      global.set(bitmapNumber, claim);
    }
  }
  return global;
}
