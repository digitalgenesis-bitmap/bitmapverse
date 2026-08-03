/**
 * Minimal JSON Schema (draft 2020-12 subset) validator for blind/v0.2's
 * three schemas. Independent copy for B1 prep tooling — deliberately not
 * imported from conformance/proof-a-v0.1/ (frozen, historically preserved;
 * see BITMAPVERSE — CONSTRUIR BLIND v0.2 instructions).
 * Supports: type, const, enum, pattern, minimum, maximum, minLength,
 * required, properties, additionalProperties, items.
 */

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

function matchesType(value, expected) {
  const actual = typeOf(value);
  if (expected === "integer") return actual === "integer";
  if (expected === "number") return actual === "integer" || actual === "number";
  return actual === expected;
}

function validateNode(schema, value, path, errors) {
  if ("const" in schema) {
    if (value !== schema.const) errors.push(`${path}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
    return;
  }
  if (schema.enum) {
    if (!schema.enum.includes(value)) errors.push(`${path}: expected one of ${JSON.stringify(schema.enum)}`);
    return;
  }
  if (schema.type) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!expected.some((t) => matchesType(value, t))) {
      errors.push(`${path}: expected type ${expected.join("|")}, got ${typeOf(value)}`);
      return;
    }
  }
  if (value === null) return;
  if (typeof value === "string") {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path}: value does not match pattern ${schema.pattern}`);
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path}: below minLength ${schema.minLength}`);
    }
  }
  if (typeOf(value) === "integer" || typeOf(value) === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: below minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: above maximum ${schema.maximum}`);
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, i) => validateNode(schema.items, item, `${path}[${i}]`, errors));
  }
  if (typeOf(value) === "object") {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${path}: missing required property "${key}"`);
    }
    const declared = schema.properties ?? {};
    for (const [key, subschema] of Object.entries(declared)) {
      if (key in value) validateNode(subschema, value[key], `${path}/${key}`, errors);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in declared)) errors.push(`${path}: additional property "${key}" not allowed`);
      }
    }
  }
}

export function validate(schema, value) {
  const errors = [];
  validateNode(schema, value, "$", errors);
  return { valid: errors.length === 0, errors };
}
