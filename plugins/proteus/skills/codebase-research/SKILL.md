---
name: codebase-research
description: Perform deep offensive codebase research for Proteus by mapping architecture, dataflow, trust boundaries, invariants, side effects, recent change risk, and high-ROI branch material. Use when Codex must understand a codebase before chaining, fuzzing, Cicada, or PoC work.
---

# Proteus Codebase Research

Use this skill to build the factual map that makes creative research possible.
The goal is not to read every file. The goal is to learn the system well enough
to choose high-ROI offensive branches and avoid obvious, known, or exhausted
paths.

Follow the Proteus base research contract. Treat every fact as future map
material: record it, link it, and use it to steer the next move.

## Operating Method

1. Recover current Proteus memory first: campaign, active rounds, surfaces,
   branches, prior findings, reports, decisions, killed paths, and revisit
   conditions.
2. Select narrow surfaces by ROI, not by directory size. Prefer boundaries with
   attacker input, authority decisions, state transitions, parser/serializer
   differences, runtime divergence, recent changes, or cross-component effects.
3. Trace attacker-controlled input through validation, normalization, storage,
   queueing, caching, authorization, rendering, execution, cleanup, and logging.
4. Extract invariants the code relies on. Ask what happens when an invariant is
   true in one component but false, stale, or differently encoded in another.
5. Identify side effects: writes, cache mutations, retries, background jobs,
   derived artifacts, generated files, locks, metrics, feature flags, and
   security-relevant metadata.
6. Convert plausible vectors into branches with kill criteria. Do not leave
   "interesting" notes unconnected to the campaign map.

## Research Priorities

- Recently introduced or recently refactored trust boundaries.
- Components where documented behavior, tests, and implementation disagree.
- Paths where local validation and downstream use rely on different
  representations.
- Shared state touched by multiple runtimes, adapters, tenants, users, build
  modes, or privilege levels.
- Code that silently preserves, drops, rewrites, replays, or defers attacker
  controlled data.
- Low-level primitives that appear harmless alone but may feed chaining:
  canonicalization drift, ordering, race/lifecycle effects, partial failure,
  object identity confusion, or stale derived state.

## Anti-Patterns

- Do not enumerate the whole repo as a substitute for choosing a surface.
- Do not chase TODO/FIXME, old fixes, or changelog hints as primary targets
  unless there is fresh bypass, regression, incomplete-fix, or chain evidence.
- Do not kill a weakly framed idea before testing whether a stronger framing
  exists through state, authority, or cross-component impact.
- Do not keep low-ROI surfaces alive after they are covered, expected, or
  duplicate-adjacent. Record the reason and move.
- Do not rely on generic scanner-style findings. Root cause and impact must
  come from the target's actual logic.

## Handoffs

- Use `chaining` when a behavior has side effects but no direct impact.
- Use `fuzzing` when an input model, parser, state machine, or adapter boundary
  needs calibrated reaction learning.
- Use Cicada when a branch has signal and a specific blocker requiring bypass,
  reliability, or exploit-development work.
- Use `web-intel` when expected behavior, public-known status, timeline, or
  duplicate risk is unclear.
- Use `poc-exploit` only after evidence justifies realistic validation.

Required output:

```json
{
  "surfaceMap": [],
  "selectedHighRoiSurfaces": [],
  "trustBoundaries": [],
  "attackerControlledInputs": [],
  "dataflows": [],
  "stateTransitions": [],
  "invariants": [],
  "sideEffects": [],
  "recentRiskAreas": [],
  "knownOrLowRoiPathsAvoided": [],
  "candidateBranches": [
    {
      "title": "...",
      "primitive": "...",
      "whyThisIsHighRoi": "...",
      "files": [],
      "nextProbe": "...",
      "killConditions": []
    }
  ],
  "handoffs": [],
  "memoryToRecord": [],
  "contractSignature": {}
}
```
