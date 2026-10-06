// Bitmapverse WORLD v0.1 — Experiment #2.
// Minimal data path: verified parcel-identities artifact → DistrictParcels.
// Carries identity only (transaction_index, transaction_id). No geometry,
// no coordinates, no ordering changes. Separate from inscription resolution.

export function toDistrictParcelsV01(artifact) {
  const { block_height, block_hash, transaction_count, transactions } =
    artifact;

  if (!Array.isArray(transactions)) {
    throw new Error("parcel artifact has no transactions array");
  }
  if (transactions.length !== transaction_count) {
    throw new Error(
      `transaction_count ${transaction_count} != transactions.length ${transactions.length}`,
    );
  }

  const parcels = transactions.map(({ transaction_index, transaction_id }, i) => {
    if (transaction_index !== i) {
      throw new Error(`position ${i} holds transaction_index ${transaction_index}`);
    }
    return { transaction_index, transaction_id };
  });

  return { block_height, block_hash, transaction_count, parcels };
}
