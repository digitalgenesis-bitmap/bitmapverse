import { resolvePubliclyAuthorizedName } from "./resolver.mjs";

const result = await resolvePubliclyAuthorizedName("bitmapverse.bitmap");
console.log(JSON.stringify(result, (key, value) => key === "resolution" ? {
  parent_inscription_id: value.parent_inscription_id,
  resolved_target: value.resolved_target,
  selected_child_inscription_id: value.selected_child_inscription_id,
} : value, 2));
if (result.status !== "ACCEPT") process.exitCode = 1;
