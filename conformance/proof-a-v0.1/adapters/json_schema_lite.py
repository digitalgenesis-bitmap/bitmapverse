"""Minimal JSON Schema (draft 2020-12 subset) validator.

Python twin of json-schema-lite.mjs. Supports exactly: type, const, enum,
pattern, minimum, minLength, required, properties, additionalProperties,
items, $ref ("#/$defs/<name>" only), $defs. Not general-purpose — keep it
scoped to what schemas/resolution-result-v01 and schemas/evidence-manifest-v01
actually use.
"""

from __future__ import annotations

import re


def _type_of(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, list):
        return "array"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, dict):
        return "object"
    return "unknown"


def _matches_type(value, expected: str) -> bool:
    actual = _type_of(value)
    if expected == "integer":
        return actual == "integer"
    if expected == "number":
        return actual in ("integer", "number")
    return actual == expected


def _resolve_ref(ref: str, root: dict) -> dict:
    match = re.match(r"^#/\$defs/(.+)$", ref)
    if not match:
        raise ValueError(f"json_schema_lite: unsupported $ref {ref}")
    defs = root.get("$defs", {})
    if match.group(1) not in defs:
        raise ValueError(f"json_schema_lite: unknown $ref target {ref}")
    return defs[match.group(1)]


def _validate_node(schema: dict, value, path: str, root: dict, errors: list) -> None:
    if "$ref" in schema:
        _validate_node(_resolve_ref(schema["$ref"], root), value, path, root, errors)
        return

    if "const" in schema:
        if value != schema["const"]:
            errors.append(f"{path}: expected const {schema['const']!r}, got {value!r}")
        return

    if "enum" in schema:
        if value not in schema["enum"]:
            errors.append(f"{path}: expected one of {schema['enum']!r}, got {value!r}")
        return

    if "type" in schema:
        expected = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        if not any(_matches_type(value, t) for t in expected):
            errors.append(f"{path}: expected type {'|'.join(expected)}, got {_type_of(value)}")
            return

    if value is None:
        return

    if isinstance(value, str):
        if schema.get("pattern") and not re.match(schema["pattern"], value):
            errors.append(f"{path}: value {value!r} does not match pattern {schema['pattern']}")
        if "minLength" in schema and len(value) < schema["minLength"]:
            errors.append(f"{path}: length {len(value)} below minLength {schema['minLength']}")

    if _type_of(value) in ("integer", "number"):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{path}: value {value} below minimum {schema['minimum']}")

    if isinstance(value, list) and "items" in schema:
        for index, item in enumerate(value):
            _validate_node(schema["items"], item, f"{path}[{index}]", root, errors)

    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                errors.append(f'{path}: missing required property "{key}"')
        declared = schema.get("properties", {})
        for key, subschema in declared.items():
            if key in value:
                _validate_node(subschema, value[key], f"{path}/{key}", root, errors)
        if schema.get("additionalProperties") is False:
            for key in value.keys():
                if key not in declared:
                    errors.append(f'{path}: additional property "{key}" not allowed')


def validate(schema: dict, value) -> tuple[bool, list]:
    errors: list = []
    _validate_node(schema, value, "$", schema, errors)
    return (len(errors) == 0, errors)


def assert_valid(schema: dict, value, label: str = "value") -> None:
    valid, errors = validate(schema, value)
    if not valid:
        raise ValueError(f"{label} failed schema validation:\n" + "\n".join(errors))
