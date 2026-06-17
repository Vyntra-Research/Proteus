---
name: chaining
description: Develop non-obvious exploit chains from primitives, trust boundaries, state transitions, interpretation gaps, and capability amplification without narrowing to bug-class checklists.
---

# Proteus Chaining

Use this skill when a surface or branch has primitives but the impact path is
not obvious.

Follow the Proteus base research contract. Work by method:

- map the attacker's current capability;
- identify authority transitions;
- identify state transitions and competing sources of truth;
- compare validation-time and use-time interpretation;
- look for capability amplification across components;
- reduce preconditions;
- define kill conditions early.

Required output:

```json
{
  "primitives": [],
  "chainCandidates": [],
  "authorityTransitions": [],
  "missingLinks": [],
  "requiredEvidence": [],
  "killConditions": [],
  "contractSignature": {}
}
```

Do not promote a finding. Produce chains that the coordinator can validate,
refute, or send to Artificer/Cicada.
