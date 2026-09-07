---
name: proteus-chaining
description: Develop non-obvious Proteus exploit chains from primitives, side effects, state drift, and component coupling.
compatibility: opencode
metadata:
  source: proteus
---

# Proteus Chaining

Use this skill when a behavior is interesting but the impact path is not yet
clear. Think like an independent human researcher: ask what this behavior
touches, what it changes indirectly, what assumptions it invalidates, and what
other component might interpret the same state differently.

Read and apply [`../../templates/base-research-contract.md`](../../templates/base-research-contract.md).
This skill adds chain construction; do not restate the base contract in the
handoff. Start from primitives, side effects, invariants, and real attacker
capability, not a bug-class list.

## Operating Method

1. State the exact observed behavior and current attacker capability.
2. Map every component, cache, queue, file, policy, parser, identity, build step,
   adapter, runtime mode, and cleanup path the behavior can influence.
3. Load `post-ai-blind-spots` for an established real sink. Enumerate every
   natural chain path reachable in the actual product graph, not only the
   obvious direct path or a fixed number of ideas. Include low-level,
   cross-component, representation, authority, and lifecycle/state paths when
   the target supports them. Group paths only after proving that they are
   equivalent for the security property under test.
4. For each branch, define preconditions, required evidence, success criteria,
   kill conditions, and a small next probe.
5. Rank by ROI: probability x impact x effort x novelty. Penalize known fixes,
   TODO-only paths, expected behavior, weak attacker boundary, and repeated
   low-signal areas.
6. Execute or recommend the next highest-ROI probes, while keeping every other
   reachable unclassified path explicit in the closure ledger. Backtrack when
   evidence kills a branch; do not keep a weak idea alive through wording and do
   not treat a deferred path as covered.
7. Before handing a finding back for delivery, run impact elevation even if the
   first impact already meets the bar. Test alternate consumers, authority and
   tenant transitions, persistence, cross-component state, native sinks, and
   stronger confidentiality, integrity, or availability outcomes.
8. Prove each link and the whole composition in one documented, recommended, or
   demonstrably common deployment. Select the strongest impact that works
   there. Reject chains that need artificial permissions, weakened limits,
   invented glue, non-standard trust, or lab-only help.

## Creative Heuristics

- Ask "what consumes this later?" not only "what happens now?"
- Compare validation-time, storage-time, transport-time, and use-time
  interpretation.
- Look for harmless local behavior that mutates shared state, authority,
  identity, routing, cache keys, locks, canonical forms, or trust decisions.
- Follow disagreement: two components that normalize, authorize, serialize,
  schedule, cache, or clean up the same object differently.
- Follow lifecycle edges: creation, replay, retry, rollback, expiration,
  migration, import/export, build/deploy, recovery, and deletion.
- Follow negative space: fields ignored by one component but preserved for
  another; errors swallowed in one layer but committed in another.
- Treat "weird but expected" as possible chain material, not a finding. Record
  why it matters or kill it.

## Anti-Patterns

- Do not promote a single surprising behavior as a vulnerability without a chain.
- Do not spend time on the obvious issue if it is already known, fixed, TODO
  marked, or low impact unless there is concrete bypass/regression/chaining
  evidence.
- Do not discard a plausible primitive just because the first framing has weak
  impact. Reframe it once through authority, state, and cross-component effects
  before killing it.
- Do not join two compatible features only because a lab can place them next to
  each other. Show that the real product creates every producer, consumer,
  transition, and authority relationship in the same deployment.
- Do not fuzz randomly. If fuzzing is needed, hand off a narrow invariant or
  differential to the fuzzing skill.

## Delegation

- Send promising branches with a concrete blocker to Cicada.
- Send branches needing realistic reproduction to `poc-exploit`.
- Send unknown contract/timeline/known-issue questions to `web-intel`.
- Send input-reaction learning or differential probing to `fuzzing`.
- Request a checkpoint after meaningful branch score changes.

Required output:

```json
{
  "observedBehavior": "...",
  "currentPrimitive": "...",
  "influenceMap": [],
  "nonObviousChainCandidates": [
    {
      "title": "...",
      "whyNonObvious": "...",
      "chainSteps": [],
      "preconditions": [],
      "sideEffectsUsed": [],
      "componentsTouched": [],
      "successCriteria": [],
      "killConditions": [],
      "roi": {
        "probability": 0,
        "impact": 0,
        "effort": 0,
        "novelty": 0
      },
      "nextProbe": "..."
    }
  ],
  "topBranches": [],
  "impactElevation": {
    "baselineImpact": "...",
    "chainsTested": [],
    "strongestRealisticImpact": "...",
    "forcedScenariosRejected": []
  },
  "branchesKilled": [],
  "postAiBlindSpotReview": {},
  "handoffs": [],
  "memoryToRecord": [],
  "contractSignature": {}
}
```

Do not promote a finding. Produce branches the coordinator can validate, refute,
checkpoint, or hand to Cicada/Artificer.
