---
name: proteus-fuzzing
description: Design calibrated Proteus fuzzing and differential probes that learn input behavior instead of spraying generic payloads.
compatibility: opencode
metadata:
  source: proteus
---

# Proteus Fuzzing

Use this skill when a narrow surface needs input-reaction learning. Fuzzing here
is an investigative loop: model the input, perturb one dimension at a time,
observe behavior, update the model, and use what is learned to sharpen a branch.

Follow the Proteus base research contract. Do not create broad payload lists and
call that research.

## Operating Method

1. Define the invariant or differential being stressed before writing probes.
2. Build an input model from real fixtures, docs, tests, runtime observations,
   and code paths. Separate syntax, semantics, lifecycle, identity, and
   authorization dimensions.
3. Choose oracles that can distinguish harmless rejection, normalization,
   partial acceptance, state mutation, downstream drift, and security impact.
4. Start with small probes that teach how the target reacts. Mutate based on
   observations, not prewritten payload folklore.
5. Compare components when possible: parser vs serializer, validation vs use,
   local vs remote, dev vs prod mode, adapter A vs adapter B, sync vs async,
   first request vs replay/retry.
6. Record both hits and negative controls. A killed mutation family is useful
   map data when it explains why a branch is low ROI.

## Mutation Strategy

- Mutate boundaries: length, nesting, ordering, duplication, absence, defaults,
  delimiters, encodings, canonical forms, and type ambiguity.
- Mutate lifecycle: create/update/delete, retry, replay, expiration, rollback,
  concurrency, restart, migration, import/export, and cache invalidation.
- Mutate interpretation: different serializers, path/URL rules, Unicode/case,
  numeric/string coercion, structured vs raw forms, metadata preservation.
- Mutate authority context: tenant/user/project/env/runtime/build mode when the
  target legitimately supports those dimensions.

## Anti-Patterns

- Do not run generic exploit payload packs unless a specific target invariant
  justifies them.
- Do not use unsafe production-style destructive probes. Stay in local/OSS or
  authorized lab scope.
- Do not treat crashes, errors, or DoS as findings unless they contradict
  documented/correct behavior and have realistic security impact.
- Do not stop at "it behaved weirdly"; explain what the behavior teaches about
  the system.

## Handoffs

- Send newly discovered primitives or differentials to `chaining`.
- Send bypass/reliability blockers with concrete signal to Cicada.
- Send reproduction-ready candidates to `poc-exploit`.
- Send expected-behavior uncertainty to `web-intel`.

Required output:

```json
{
  "targetInvariant": "...",
  "inputModel": {
    "syntax": [],
    "semantics": [],
    "lifecycle": [],
    "authorityContext": []
  },
  "oracles": [],
  "probeFamilies": [
    {
      "family": "...",
      "whatItCanTeach": "...",
      "cases": [],
      "expectedSafeBehavior": "...",
      "killCondition": "..."
    }
  ],
  "observations": [],
  "modelUpdates": [],
  "candidatePrimitives": [],
  "negativeControls": [],
  "handoffs": [],
  "contractSignature": {}
}
```
