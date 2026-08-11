# ADF Glossary

This glossary defines the canonical language used by the framework and its generated repositories.

## Approval

An explicit human decision that permits a lifecycle transition. A successful validation never creates an approval.

## Authority

The capacity in which a document speaks: product, technical, observational, or reference. Authority determines whether a statement governs work or only provides context.

## Gate

A checkable transition point in the ADF lifecycle. A gate combines deterministic evidence with any required human approval.

## Lifecycle

The project-wide stage recorded in `.harness/STATE.md`. It routes a new agent session to the correct procedure.

## Managed file

A file created or merged by ADF whose installed digest and update strategy are recorded in `.harness/manifest.yml`.

## Reference

Source material that contributes context but does not become a requirement unless a governing document explicitly adopts it.

## Validation

A deterministic or evidence-backed check. Validation can prove that stated criteria pass; it cannot decide whether the product or plan is approved.
