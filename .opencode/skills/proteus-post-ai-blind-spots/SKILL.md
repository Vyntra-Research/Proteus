---
name: proteus-post-ai-blind-spots
description: Close every real reachable natural path around an established Proteus sink before terminal coverage decisions.
compatibility: opencode
metadata:
  source: proteus
---

# Proteus Post-AI Blind-Spot Heuristics

Use this skill after evidence establishes a real sink or attacker-influenced
primitive. Its purpose is to prevent a familiar implementation pattern, passing
functional tests, nearby documentation, or agreement between models from
closing a path that has not been proved safe across the real product.

Read and apply [`../../templates/base-research-contract.md`](../../templates/base-research-contract.md).
This skill adds a complete sink-closure method. It does not weaken the attacker,
realism, dedupe, evidence, or promotion gates.

The name "Post-AI Blind-Spot Heuristics" identifies this method. It does not
claim that AI wrote the target or caused a vulnerability. AI provenance, code
style, age, uniformity, and reviewer count neither open nor promote a
hypothesis.

## Mandatory Closure Invariant

Total coverage is a rule, not a relative score, sample, time budget, or
best-effort target. Once a real sink is established, keep it open until every
natural path reachable in the declared target, version, deployment topology,
and attacker model has been classified with evidence.

Do not silently shrink the coverage universe after a hard path appears. Time,
complexity, repeated negative probes, local correctness, apparent intent,
passing tests, prior review, model agreement, or lack of an intuitive exploit
chain cannot support `killed`, `discarded`, `covered`, `safe`, `exhausted`, or a
pivot that abandons the sink.

A pause or external blocker may stop current execution. It leaves every
unresolved path open and records exact resume conditions.

Correct and intentional behavior remains chain material. A component does not
need to be locally defective when its natural composition with another
consumer, state, representation, or authority boundary violates a security
property.

## Activation

Load this skill:

- after establishing a real sink or attacker-influenced primitive;
- when behavior appears standard, correct, defensive, or intentional;
- when implementation, tests, comments, documentation, or model reviews may
  inherit the same premise;
- when the primitive crosses components, representations, lifecycle states,
  runtimes, deployments, identities, tenants, or authority contexts;
- before killing, downgrading, abandoning, or pivoting away from the sink;
- before claiming exhaustion, safety, or complete coverage;
- after finding one valid chain, while checking the same sink for parallel or
  stronger natural chains.

Do not load it merely because code appears AI-generated. A real sink and a
campaign-valid security question must come first.

## Complete Coverage Method

### 1. Fix the coverage universe

Record the exact target, version or ref, real deployment topology, supported or
common configuration, attacker capabilities, protected actors and resources,
and scope boundaries. A later scope reduction requires an explicit campaign or
user decision; difficulty is not a scope boundary.

Enumerate every reachable class connected to the sink:

- producers and attacker-controlled inputs;
- validation, normalization, encoding, decoding, serialization, and parsing;
- stored, cached, queued, derived, generated, logged, and exported forms;
- creation, update, replay, retry, rollback, expiration, migration, recovery,
  cleanup, and deletion;
- direct, alternate, delayed, privileged, native, upstream, and third-party
  consumers that exist in the same real topology;
- runtime, operating-system, build, deploy, worker, adapter, and compatibility
  modes in declared scope;
- user, tenant, service, worker, administrator, and machine identities and the
  authority changes between them;
- persistent and transient side effects, including writes, policy decisions,
  routing, cache keys, locks, credentials, generated artifacts, and execution.

Group paths only when evidence proves they are structurally equivalent for the
property under test. Convenience or similar names are not equivalence proof.

### 2. Separate evidence from inherited premises

For every security conclusion, record:

1. the expected security property;
2. its independent documentary, protocol, architectural, or threat-model basis;
3. the context required for the property to hold;
4. direct observed evidence and discriminating negative controls;
5. known analysis limits;
6. the conclusion state: `supported_in_scope`, `violated`, or `indeterminate`.

Implementation-derived tests, comments beside the code, nearby documentation
that restates the implementation, and additional model opinions may all repeat
one false premise. Count a source as independent only when it contributes a
distinct authoritative contract, direct observation, discriminating control,
corrected comparison, or other new evidence.

`No problem found` is not `property supported`. An untested property is
`indeterminate`.

### 3. Expand forward from the primitive

Build a forward capability graph:

```text
attacker control -> transformations -> representations -> storage/state ->
lifecycle paths -> consumers -> authority transitions -> side effects
```

Follow every real outgoing edge. Ask what consumes the value or state later,
what persists it, which identity acts on it, how failure and recovery change
it, and whether another component interprets the same representation
differently.

### 4. Expand backward from CIA impact

For each protected actor or resource in scope, enumerate concrete unacceptable
confidentiality, integrity, and availability outcomes. Work backward from each
outcome through the product capabilities, states, identities, and transitions
required to reach it.

Impact is an active search direction. Do not wait for an obvious exploit to
suggest which consequence to test.

### 5. Resolve every natural intersection

Cross the forward capability graph with the backward CIA graph. Every natural
intersection becomes a path to confirm, refute, or keep indeterminate with an
exact blocker. Prove every required edge in code, an authoritative contract, or
execution, then prove the end-to-end composition in one real deployment.

An essential contradicted edge refutes that path. An untested or inaccessible
edge keeps that path and the sink open.

### 6. Reject artificial chains

Total coverage applies only to real product paths. Never add permissions,
trusted inputs, disabled controls, weakened limits, target patches, fictional
integrations, unsupported states, or lab behavior to connect two otherwise
separate features. Every producer, consumer, transition, permission, and
authority relationship must exist naturally in the same documented,
recommended, supported, or demonstrably common correct-practice deployment.
Never invent product states or lab glue.

### 7. Record the closure ledger

Persist this object in the branch handoff and include its decisive summary in
the next Proteus checkpoint:

```json
{
  "postAiBlindSpotReview": {
    "sink": "...",
    "observedPrimitive": "...",
    "coverageUniverse": {
      "producers": [],
      "transformations": [],
      "representations": [],
      "persistenceAndCaches": [],
      "lifecycleAndRecovery": [],
      "consumers": [],
      "runtimeAndDeploymentModes": [],
      "identitiesAndAuthorities": [],
      "integrations": [],
      "sideEffects": []
    },
    "propertyLedger": [
      {
        "property": "...",
        "independentBasis": [],
        "requiredContext": [],
        "observedEvidence": [],
        "negativeControls": [],
        "limits": [],
        "status": "supported_in_scope | violated | indeterminate"
      }
    ],
    "forwardCapabilityGraph": [],
    "backwardCiaGraph": {
      "confidentiality": [],
      "integrity": [],
      "availability": []
    },
    "naturalIntersections": [
      {
        "path": [],
        "edgeEvidence": [],
        "status": "confirmed | refuted | indeterminate"
      }
    ],
    "premiseLineage": {
      "implementationDerived": [],
      "independentEvidence": []
    },
    "unresolvedReachableEdges": [],
    "disposition": "continue | candidate | blocked_open | covered_safe",
    "closureBasis": "...",
    "reopenConditions": []
  }
}
```

Use `covered_safe` only when `unresolvedReachableEdges` is empty, every natural
intersection is confirmed or refuted, each relevant CIA axis is classified,
and every `supported_in_scope` property has independent evidence. Otherwise use
`continue` or `blocked_open`.

Finding acceptance and sink closure are separate. One proved chain may be
report-grade while parallel or stronger paths remain open.

## Handoffs and Review

- Return to `codebase-research` when the coverage universe or a reachable edge
  is still unmapped.
- Use `chaining` for natural intersections that need capability amplification.
- Use `fuzzing` for a bounded parser, adapter, representation, or state-machine
  differential.
- Use `poc-exploit` when a path has enough evidence for realistic end-to-end
  validation.
- Use `checkpoint` after the ledger changes a terminal decision, exposes a new
  path, or records a blocker and resume condition.

## Concrete Cases

### Authorization survives one component

Insufficient: "The gateway performs authorization and its tests pass, so the
path is safe."

Required: identify the independent authorization property; trace identity and
decision meaning through serialization, caches, queues, workers, retries,
recovery, and alternate consumers; then prove that every consumer preserves the
same tenant, object, and authority binding. A correct gateway does not prove
that a natural downstream consumer acts with the same authority.

### Intentional normalization

Insufficient: "The target uses its standard normalization helper, so the result
is expected."

Required: compare validation-time, storage-time, transport-time, and use-time
forms across supported operating systems, runtimes, archives, URLs, paths,
case rules, and encodings. Identify each later consumer and prove that it gives
the canonical form the same meaning. Intentional normalization may remain
locally correct while a second correct consumer uses different semantics.

### Cleanup and recovery

Insufficient: "This code only cleans temporary state and has no direct attacker
chain."

Required: trace partial failure, retry, rollback, stale state, double
consumption, changed ownership, expiration, recovery, and later reuse. Identify
which principal performs each transition and whether the side effect changes
routing, authorization, persistence, locks, generated output, or a later input.

### Agreement between reviewers

Insufficient: "Three agents reviewed the path and found no chain."

Required: list the distinct evidence each reviewer added. Treat reasoning from
the same implementation, tests, or nearby documentation as one premise lineage.
Keep the property indeterminate when no reviewer added an authoritative
contract, direct observation, discriminating control, or corrected comparison.
Votes are not new evidence.

### Correct feature composition

Insufficient: "Both features behave as documented, so their composition cannot
be a bug."

Required: prove that both features coexist naturally in one documented,
recommended, supported, or demonstrably common deployment; map the state,
representation, identity, and authority transferred between them; and evaluate
the complete composition under CIA. Reject invented glue, but do not treat local
correctness as closure when the composition exists naturally.

### One valid finding

Insufficient: "The direct chain is report-grade, so the sink is complete."

Required: deliver the proved finding on its own evidence while keeping the sink
open for alternate consumers, lifecycle paths, authority transitions,
representations, and stronger or parallel CIA effects. The Judge may accept the
finding without declaring the wider sink exhausted.

The final handoff must include the complete `postAiBlindSpotReview`, the next
unresolved edge with highest expected ROI, and the ordinary `contractSignature`
required by the base contract. Do not claim absence, safety, or exhaustion from
review effort alone.
