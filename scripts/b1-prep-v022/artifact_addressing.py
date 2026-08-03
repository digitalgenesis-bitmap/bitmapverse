"""Content-addressed artifact identity - Python twin of artifact-addressing.mjs.

Covers the format/path-derivation logic only (pure functions, no filesystem
I/O) — the on-disk verification (symlink/regular-file/hash/size checks)
is exercised via the JS twin's verifyArtifactOnDisk; duplicating real
filesystem I/O in both languages wasn't judged necessary for this
correction pass, since the format rules (the part most likely to diverge
between languages) are what's cross-checked here.
"""

from __future__ import annotations

import re

ARTIFACT_ID_PATTERN = re.compile(r"^sha256:[0-9a-f]{64}$")


class ArtifactAddressingError(Exception):
    pass


def is_valid_artifact_id(artifact_id) -> bool:
    return isinstance(artifact_id, str) and bool(ARTIFACT_ID_PATTERN.match(artifact_id))


def hash_of_artifact_id(artifact_id: str) -> str:
    if not is_valid_artifact_id(artifact_id):
        raise ArtifactAddressingError(f"invalid artifact_id: {artifact_id!r}")
    return artifact_id[len("sha256:") :]


def artifact_path_for(artifact_id: str) -> str:
    return "artifacts/sha256/" + hash_of_artifact_id(artifact_id)
