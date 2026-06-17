---
name: fuzzing
description: Design targeted fuzzing, differential probes, harnesses, and oracles for narrow Proteus surfaces without doing random broad fuzzing.
---

# Proteus Fuzzing

Use this skill when a parser, state machine, adapter boundary, canonicalization
step, or other narrow surface needs systematic anomaly discovery.

Follow the Proteus base research contract. Prefer targeted methods:

- derive an input model from real fixtures and documented behavior;
- define oracles before generating cases;
- compare parser, runtime, adapter, or state-machine differentials;
- mutate around boundaries, representations, order, replay, and lifecycle;
- keep probes low-noise and explain what each family can prove or kill.

Required output:

```json
{
  "inputModel": "...",
  "mutationFamilies": [],
  "oracles": [],
  "differentials": [],
  "harnessPlan": [],
  "triageRules": [],
  "killConditions": [],
  "contractSignature": {}
}
```

Do not list bug classes as the plan. Name the invariant or differential each
probe stresses.
