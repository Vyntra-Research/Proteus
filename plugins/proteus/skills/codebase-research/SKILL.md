---
name: codebase-research
description: Perform deep codebase research for Proteus by mapping architecture, dataflow, trust boundaries, invariants, and recent change risk.
---

# Proteus Codebase Research

Use this skill to build the factual code understanding needed before branching
or delegation.

Follow the Proteus base research contract. Prioritize:

- entrypoints and authority boundaries;
- dataflow from attacker-controlled input to security-sensitive use;
- invariants the code assumes;
- state ownership and sources of truth;
- build/runtime/adapter differences;
- recent changes and newly introduced complexity.

Required output:

```json
{
  "surfaceMap": [],
  "trustBoundaries": [],
  "stateTransitions": [],
  "invariants": [],
  "attackerControlledInputs": [],
  "recentRiskAreas": [],
  "candidateBranches": [],
  "killConditions": [],
  "contractSignature": {}
}
```
