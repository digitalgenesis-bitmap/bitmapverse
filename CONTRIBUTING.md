## Language Policy

This policy applies from this point forward and remains in effect unless
explicitly superseded.

All repository-facing artifacts must be written in English, including:

- source code
- UI text
- documentation
- README files
- specifications
- schemas
- comments
- tests
- commit messages
- pull requests
- reports stored in the repository
- examples
- generated documentation

Spanish is reserved exclusively for conversation with The Source Revelator.

Historical sealed artifacts (blind/v0.1, blind/v0.2, blind/v0.2.1) remain
as-is and are not rewritten for linguistic reasons.

## Local Private Audit Environment

`BITMAPVERSE_PRIVATE_DIR` is an optional, local-only environment
variable. It points to an authorized local directory containing private
audit material and is read only by `npm run test:private-audit`.

- It must never be configured in public CI or in any production
  deployment.
- No secret value, private path, or secret-derived content should ever
  be committed to this repository — not in code, not in documentation,
  not in commit messages.
- If it is unset, `npm run test:private-audit` skips safely rather than
  failing with an unhandled error.

This variable has no effect on `npm run test:all` or `npm test`, which
never read private material and remain reproducible on a clean clone.
