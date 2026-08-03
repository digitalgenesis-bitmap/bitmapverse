export type ShadowRole = "SCOUT" | "KEEPER" | "VOID";
export type ShadowRecommendation =
  | "continue_experiment"
  | "preserve_with_warnings"
  | "do_not_promote";

export type ShadowSignal = {
  schema: "bitmapverse.shadow_signal.v0.1";
  signal_id: string;
  case_id: string;
  case_canonical_sha256: string;
  role: ShadowRole;
  status: "shadow";
  authority: "none";
  recommendation: ShadowRecommendation;
  confidence: "low" | "medium" | "high";
  observations: string[];
  risks: string[];
  authorizes_transition: false;
  mutates_state: false;
};

export function validateSignalCaseV01(
  signalCase: unknown,
  evidenceByPath: Record<string, string>,
): { origin: Record<string, unknown>; destination: Record<string, unknown> };

export function evaluateShadowRoleV01(
  role: ShadowRole,
  signalCase: unknown,
  evidenceByPath: Record<string, string>,
): ShadowSignal;

export function runShadowCouncilV01(
  signalCase: unknown,
  evidenceByPath: Record<string, string>,
): {
  schema: "bitmapverse.shadow_council_run.v0.1";
  case_id: string;
  case_canonical_sha256: string;
  status: "shadow";
  authority: "none";
  independent_inputs: true;
  signals: ShadowSignal[];
  transition: { authorized: false; state_mutated: false; reason: string };
};
