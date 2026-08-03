/**
 * Minimal JSON Schema (draft 2020-12 subset) validator.
 *
 * Supports exactly the keywords used by schemas/resolution-result-v01 and
 * schemas/evidence-manifest-v01: type, const, enum, pattern, minimum,
 * minLength, required, properties, additionalProperties, items, $ref
 * (only "#/$defs/<name>"), $defs. Not a general-purpose validator — do not
 * extend it to cover keywords the two schemas don't use.
 */

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }
  return typeof value; // "object" | "string" | "boolean"
}

function matchesType(value, expected) {
  const actual = typeOf(value);
  if (expected === "integer") return actual === "integer";
  if (expected === "number") return actual === "integer" || actual === "number";
  return actual === expected;
}

function resolveRef(ref, root) {
  const match = /^#\/\$defs\/(.+)$/.exec(ref);
  if (!match) throw new Error(`json-schema-lite: unsupported $ref ${ref}`);
  const def = root.$defs?.[match[1]];
  if (!def) throw new Error(`json-schema-lite: unknown $ref target ${ref}`);
  return def;
}

function validateNode(schema, value, path, root, errors) {
  if (schema.$ref) {
    validateNode(resolveRef(schema.$ref, root), value, path, root, errors);
    return;
  }

  if ("const" in schema) {
    if (value !== schema.const) {
      errors.push(`${path}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
    }
    return;
  }

  if (schema.enum) {
    if (!schema.enum.includes(value)) {
      errors.push(`${path}: expected one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(value)}`);
    }
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
      errors.push(`${path}: value ${JSON.stringify(value)} does not match pattern ${schema.pattern}`);
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path}: length ${value.length} below minLength ${schema.minLength}`);
    }
  }

  if (typeOf(value) === "integer" || typeOf(value) === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path}: value ${value} below minimum ${schema.minimum}`);
    }
  }

  if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => {
      validateNode(schema.items, item, `${path}[${index}]`, root, errors);
    });
  }

  if (typeOf(value) === "object") {
    for (const key of schema.required ?? []) {
      if (!(key in value)) {
        errors.push(`${path}: missing required property "${key}"`);
      }
    }
    const declared = schema.properties ?? {};
    for (const [key, subschema] of Object.entries(declared)) {
      if (key in value) {
        validateNode(subschema, value[key], `${path}/${key}`, root, errors);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in declared)) {
          errors.push(`${path}: additional property "${key}" not allowed`);
        }
      }
    }
  }
}

export function validate(schema, value) {
  const errors = [];
  validateNode(schema, value, "$", schema, errors);
  return { valid: errors.length === 0, errors };
}

export function assertValid(schema, value, label = "value") {
  const { valid, errors } = validate(schema, value);
  if (!valid) {
    throw new Error(`${label} failed schema validation:\n${errors.join("\n")}`);
  }
}
