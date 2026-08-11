---
name: grilling
description: "Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases."
license: MIT
metadata:
  adf-version: "0.1.0"
  upstream-name: "grilling"
---


Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled — the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.

Each question should be formatted like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Each round the user answers reshapes the tree — settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. Use subagents for independent fact-finding when available; otherwise inspect the filesystem and tools yourself before asking. Facts are prerequisites you resolve from evidence. The _decisions_ are the user's — put each decision to them and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.

## ADF boundaries

Keep Git changes local until the user explicitly authorizes a commit, push, release, or deployment. End with a file inventory covering every created, modified, or deleted path; for read-only work, report `Writes: none`.
