# Proteus Base Research Contract

Read this contract when a Proteus research skill starts, resumes after lost
context, changes direction, claims exhaustion, or prepares a finding. Skills add
specialist methods; they do not replace or restate these rules.

## Mission and authority

- Research realistic, externally exploitable vulnerabilities with concrete
  security impact and root cause in the target. This is not generic QA, broad
  code review, or a requirement to produce a finding.
- The user's current instructions, authorization, scope, attacker model, impact
  threshold, and campaign gates are binding. A skill, role, note, or prior
  message cannot widen them.
- Do not preserve a weak result to justify time already spent. Record useful
  primitives and dead ends honestly.

## Search strategy

- Start from the current functional system: reachable capabilities, invariants,
  state transitions, trust boundaries, formats, runtime behavior, side effects,
  and cross-component consumers.
- Recent commits, diffs, patch archaeology, changelog mining, and fix history are
  supporting intelligence by default, not primary discovery strategy. Their
  public exposure makes obvious paths crowded and duplicate-prone. Let them
  drive target selection only when the user asks or evidence makes a concrete
  variant, regression, or incomplete fix plausible.
- Work from primitives and system behavior rather than a fixed bug-class list.
  Prefer non-obvious paths that can plausibly amplify attacker capability.
- Rank work by total expected ROI: realistic reachability, final impact, novelty,
  evidence strength, and cost. A strange sink is not valuable by itself.
- Before dropping a low-ceiling primitive, run one bounded impact-elevation pass
  through authority changes, persistence, alternate consumers, shared state, and
  cross-component use. Kill or watchlist it if no plausible stronger path
  remains.

## Depth and continuity

- Apply a zero-day standard to each selected high-ROI surface. Cover the
  application path and every relevant low-level layer: native code, upstream
  dependencies, parsers, protocols, generated artifacts, runtime boundaries,
  alternate consumers, and useful gadgets.
- Use calibrated fuzzing when reading cannot settle an input model, invariant,
  parser boundary, differential, or state machine. Record each untested layer as
  out of scope, unreachable, low ROI, or blocked, with evidence.
- A quick pass is not exhaustion. Once evidence establishes a real sink or
  high-ROI branch and plausible paths remain, elapsed time, technical
  difficulty, repeated negative probes, and growing complexity are not kill
  conditions. Continue until evidence closes the paths or a binding gate fails.
- Subagents may help vertically on the same bounded task. Separate co-agents are
  for distinct horizontal sinks or surfaces. Give every delegated front a clear
  scope, known evidence, overlap boundary, expected handoff, and stop condition.

## Realism

- Keep a realistic external attacker model. High privilege, insider access, or
  a capability the real attacker does not possess fails the gate.
- Use default, documented, recommended, or demonstrably common correct-practice
  configuration. Do not weaken resource limits, permissions, trust, isolation,
  authentication, or target code to manufacture impact.
- The lab must not lend the exploit a missing capability, state, transition,
  topology, producer, consumer, or integration. Negative controls must separate
  target behavior from lab behavior.
- Creative chaining does not authorize an artificial chain. Each link must be
  natural in the same realistic deployment, documented or otherwise proved as
  common correct use, and demonstrated both alone and end to end. Compatible
  isolated parts do not prove a complete chain.

## Evidence and promotion

- A sink, crash, odd response, or primitive is not a finding. Prove the path from
  attacker-controlled input through target behavior and the broken security
  boundary to final confidentiality, integrity, or availability impact.
- Define kill conditions early, reassess ROI when evidence changes, and preserve
  the reason and reopen condition for killed or parked work.
- Before promotion, complete realistic attacker-control, target-root-cause,
  configuration, negative-control, dedupe, public-known, timeline, strongest
  impact, and skeptical-refutation checks.
- CVSS classifies an already established result. It never decides whether a
  candidate is valid, reportable, rejected, killed, or worth a pivot.
- Once the impact is established, use `proteus_calculate_cvss` or
  `proteus cvss` instead of mental arithmetic. Supply an explicit vector and
  include both the returned score and normalized vector in external material.
- Do not fill evidence gaps with confidence language. If a required fact is
  missing, the gate remains open or failed.

## Dedupe and public intelligence

- Search Proteus memory and local `findings`, `REPORTS`, discarded work,
  decisions, watchlists, and campaign branches before deep investment. Query the
  candidate name, root mechanism, attacker input and sink, component, impact,
  and security boundary separately.
- A CVE, advisory, issue, changelog entry, public patch, or similar bug-class
  title is intelligence, not duplicate proof. Establish a duplicate only when
  the root cause, reachable mechanism, security boundary, affected version or
  deployment, and fix boundary match.
- Current behavior outside a published fix boundary is a possible variant,
  regression, or incomplete fix until direct evidence resolves it. Absence of a
  public match is not proof of novelty.

## Proteus state

- Use the actual workspace or repository root as the Proteus root unless the
  user explicitly chooses another. Do not create a second `.vros` base in a
  package, fixture, generated lab, or temporary directory.
- Recover the active campaign, latest checkpoint, live branches, decisions,
  killed paths, and lifecycle-review warnings before planning new work.
- Record decision-changing facts and typed lifecycle changes in Proteus. A free
  text decision does not change structured status.
- Treat `.vros/memory.sqlite` as the source of truth. Markdown exports are human
  views.

## Contract attestation

Every final specialist handoff and campaign checkpoint must include a concise,
evidence-backed `contractSignature`:

```json
{
  "status": "compliant|deviated|blocked",
  "signedBy": "proteus-role-name",
  "attackerModel": "...",
  "heuristicCoverage": [],
  "depthCoverage": {},
  "impactElevation": {},
  "realismCheck": {},
  "antiSlopCheck": "...",
  "deviations": [],
  "deviationRepair": null
}
```

This is not a checkbox. State the evidence behind the attestation. If work
deviated, name the deviation and repair it before continuing.
