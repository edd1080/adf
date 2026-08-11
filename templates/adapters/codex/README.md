# Codex adapter

ADF uses the repository-root `AGENTS.md` and `.agents/skills/` as the shared Codex contract. GitHub Spec Kit's `codex` integration owns its own `speckit-*` skills in that same discoverable root.

Version 0.1.0 emits no `.codex/config.toml`. Add a Codex-specific configuration file only after an official capability requires it and a focused merge test protects existing user configuration.
