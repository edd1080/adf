# npx Distribution Design

## Public identity

- npm package: `adf-harness-kit`
- primary npx binary: `adf-harness-kit`
- retained operational binary: `adf`
- initial public version: `0.1.0`
- repository: `https://github.com/edd1080/adf`

The requested name `agent-harness-kit` cannot be used because it is already owned by an unrelated, similar npm project.

## Two entry paths

### Guided entry

`npx adf-harness-kit@latest` launches a terminal wizard. It asks for the target, primary agent, optional additional agent, and whether existing documentation is present. It then delegates to the same installation engine as `adf init`, displays the complete preview, requests approval, validates the result, and prints the exact first chat prompt.

### Agent-operated entry

The user can paste Prompt 1 into Codex or OpenCode instead of answering the wizard. The agent translates the request into explicit `npx adf-harness-kit@latest init ... --dry-run` and apply commands. Natural-language parsing stays with the coding agent rather than being duplicated inside the CLI.

## `init` boundary

`adf init` remains the deterministic installation engine. It inspects the target, detects Spec Kit and integrations, plans changes, blocks conflicts, initializes Spec Kit, composes the harness, registers local Spec Kit assets, runs doctor, and prints the next action. It does not conduct product discovery, approve G1, select a feature, or write product code.

## Documentation handoff

When the wizard records an existing documentation path, it does not move or parse those documents during installation. It includes the path in the final first prompt so that `project-intake` handles inventory and normalization after the harness is active.

## Release safety

- Package contents are verified before publication.
- The first GitHub history is created on `main` because the remote is empty.
- npm publication requires an authenticated owner and a final clean-room install.
- GitHub push, npm publish, tag, and release are separately evidenced.
