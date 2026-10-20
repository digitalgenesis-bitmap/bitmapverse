export type InteractionTarget = { id: string; x: number; z: number };
export type ActorPosition = { x: number; z: number };
export type InteractionDistrict = {
  blockHeight: number;
  transactionCount: number;
};
export type InspectResult =
  | { ok: false; reason: "unknown-target" | "out-of-range" }
  | {
      ok: true;
      response: { title: string; district: string; transactions: string };
    };

export const DISTRICT_STRUCTURE: Readonly<InteractionTarget>;
export const INTERACTION_RADIUS: number;
export function horizontalDistance(
  actor: ActorPosition,
  target: { x: number; z: number },
): number;
export function isInInteractionRange(
  actor: ActorPosition,
  target?: InteractionTarget,
  radius?: number,
): boolean;
export function inspectDistrictStructure(
  target: InteractionTarget,
  actor: ActorPosition,
  district: InteractionDistrict,
): InspectResult;
