---
name: grill-with-docs
description: "Interview the user to sharpen a plan while maintaining the ADF glossary and architectural decisions. Use during discovery when decisions remain unresolved and durable documentation is required."
license: MIT
metadata:
  adf-version: "0.1.0"
  upstream-name: "grill-with-docs"
  adf-dependencies: "grilling,domain-modeling"
---

Run a `/grilling` session, using the `/domain-modeling` skill.

After every resolved term or durable decision, invoke the matching dependency immediately. Completion requires an empty decision frontier plus a final inventory of the documentation updated during the interview.

## ADF boundaries

Keep Git changes local until the user explicitly authorizes a commit, push, release, or deployment. End with a file inventory covering every created, modified, or deleted path; for read-only work, report `Writes: none`.
