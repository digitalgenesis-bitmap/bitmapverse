"""Role-conditional validation of implementation_identity - Python twin
of implementation-identity.mjs. Kept byte-for-byte equivalent in logic
(not just result) so a Python-based independent implementer's own
validation matches this project's reference exactly.
"""

from __future__ import annotations

OFFICIAL_OPI_REPOSITORY = "https://github.com/bestinslot-xyz/OPI"
FIXED_OPI_COMMIT = "da24fb6cf4c2ef3f99d030ea2ef18ba9099b0633"


class ImplementationIdentityError(Exception):
    pass


def validate_implementation_identity(role: str, identity: dict) -> tuple[bool, list]:
    errors: list = []

    if role == "bitmap_discovery":
        if identity.get("verification_method") != "commit":
            errors.append(
                f"bitmap_discovery requires verification_method \"commit\", got {identity.get('verification_method')!r}"
            )
        if identity.get("repository") != OFFICIAL_OPI_REPOSITORY:
            errors.append(
                f"bitmap_discovery requires repository {OFFICIAL_OPI_REPOSITORY}, got {identity.get('repository')!r}"
            )
        if identity.get("commit") != FIXED_OPI_COMMIT:
            errors.append(f"bitmap_discovery requires commit {FIXED_OPI_COMMIT}, got {identity.get('commit')!r}")
        return (len(errors) == 0, errors)

    method = identity.get("verification_method")
    if method == "commit":
        if not identity.get("repository") or not identity.get("commit"):
            errors.append('verification_method "commit" requires both repository and commit')
    elif method == "release_hash":
        if not identity.get("release") or not identity.get("release_hash_sha256"):
            errors.append('verification_method "release_hash" requires both release and release_hash_sha256')
    elif method == "binary_sha256":
        if not identity.get("binary_sha256"):
            errors.append('verification_method "binary_sha256" requires binary_sha256')
    elif method == "container_digest":
        if not identity.get("container_digest"):
            errors.append('verification_method "container_digest" requires container_digest')
    else:
        errors.append(f"unknown verification_method: {method!r}")

    return (len(errors) == 0, errors)
