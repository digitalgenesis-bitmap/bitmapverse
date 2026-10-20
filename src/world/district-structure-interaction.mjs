// Bitmapverse 3D — Experiment #20.
// ONE target, ONE proximity condition, ONE semantic action, ONE response.
// Deliberately not a general interaction framework. No input handling here:
// the human keyboard adapter lives in the 3D component and only calls the action.

export const DISTRICT_STRUCTURE = Object.freeze({
  id: "district-structure-937336",
  x: 0,
  z: -2,
});

// World units, horizontal (X/Z) distance only; eye height is ignored.
export const INTERACTION_RADIUS = 5;

export function horizontalDistance(actor, target) {
  return Math.hypot(actor.x - target.x, actor.z - target.z);
}

// Inclusive boundary: distance === radius is in range.
export function isInInteractionRange(
  actor,
  target = DISTRICT_STRUCTURE,
  radius = INTERACTION_RADIUS,
) {
  return horizontalDistance(actor, target) <= radius;
}

// Semantic action. The action itself re-verifies proximity, so no input
// adapter can bypass the range rule. `district` is the already-resolved
// canonical context: { blockHeight, transactionCount }.
export function inspectDistrictStructure(target, actor, district) {
  if (target?.id !== DISTRICT_STRUCTURE.id) {
    return { ok: false, reason: "unknown-target" };
  }
  if (!isInInteractionRange(actor, target)) {
    return { ok: false, reason: "out-of-range" };
  }
  const name = `${district.blockHeight}.bitmap`;
  return {
    ok: true,
    response: {
      title: `BITMAPVERSE / ${name}`,
      district: name,
      transactions: district.transactionCount.toLocaleString("en-US"),
    },
  };
}
