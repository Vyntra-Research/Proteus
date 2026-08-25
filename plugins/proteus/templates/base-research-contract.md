# Proteus Base Research Contract

Every Proteus role and skill must continuously follow this contract.

## Method

- Work through primitives, invariants, trust boundaries, state transitions,
  interpretation gaps, competing sources of truth, and capability amplification.
- Do not reduce the hunt to a fixed bug-class checklist.
- Use bug classes only as examples or local context, never as the primary search
  frame.
- Prefer non-obvious paths that can plausibly become realistic exploit chains.
- Apply a zero-day research standard to each selected surface. Trace the visible
  application path and the relevant low-level layers: native code, upstream
  dependencies, parsers, protocols, generated artifacts, runtime boundaries,
  and alternate consumers or gadgets.
- Use calibrated fuzzing when code reading cannot settle an input model,
  invariant, parser boundary, or state machine. Do not leave a relevant layer
  untested without recording why it is out of scope, unreachable, or low ROI.
- A quick pass is not completed research. Close the selected surface with
  evidence, explicit residual gaps, or a concrete blocker.

## Proteus Memory Root

- Prefer the actual workspace/repository root for Proteus state unless the user
  explicitly instructs a different root.
- Before initializing or recording state, confirm that `--root` points at the
  intended workspace root, not a package, fixture, generated lab, or nested
  subdirectory.
- Do not create a second `.vros` base in a subfolder just because the current
  shell is there. Use `--root <workspace-root>` instead.
- If state was accidentally created in the wrong place, merge it into the
  canonical workspace base before continuing. Examples:
  - `proteus merge --root <workspace-root> --source ./packages/foo/.vros/memory.sqlite`
  - `proteus merge --root <workspace-root> --sources ./old/.vros/memory.sqlite,./nested/.vros`
- Treat root/base drift as research-state corruption risk: pause recording,
  inspect `proteus status --root <expected-root>`, then merge or discard the
  stray base deliberately.

## Validation

- Maintain a realistic attacker model.
- Do not rely on lab-only help, disabled controls, patched target code, or
  non-standard configuration unless official target documentation requires it.
- Do not weaken resource limits, trust settings, isolation, authentication, or
  other deployment controls to manufacture impact. Lowering a memory limit to
  force OOM is not proof of a vulnerability in the normal product scenario.
- Validate expected behavior before treating behavior as vulnerable.
- Check memory, known findings, reports, discarded paths, TODO or known-issue
  context, advisories, issues, and changelogs before investing heavily.
- Run local dedupe with separate queries for the candidate name, root mechanism,
  attacker input and sink, affected component, and realistic impact. One long
  prose query does not close the duplicate gate.
- Track kill conditions from the beginning and kill weak hypotheses early.
- Reassess ROI after new evidence.
- Before delivering any finding, run an impact-elevation pass. Test realistic
  chains, alternate consumers, privilege or tenant transitions, durable side
  effects, and stronger CIA outcomes. Keep the highest impact that works in a
  common, correctly configured scenario without forced assumptions.

## Promotion Standard

Do not promote speculative findings. A candidate needs attacker control, root
cause in the target, concrete impact, correct-practice configuration, negative
controls, dedupe, public-known checks, and rebutted objections.

## Contract Signature

Every final output and checkpoint must include:

```json
{
  "contractSignature": {
    "status": "compliant|deviated|blocked",
    "signedBy": "proteus-role-name",
    "attackerModel": "...",
    "heuristicCoverage": [],
    "depthCoverage": {
      "application": "checked|not-applicable|blocked",
      "nativeOrLowLevel": "checked|not-applicable|blocked",
      "upstreamDependencies": "checked|not-applicable|blocked",
      "fuzzing": "checked|not-applicable|blocked",
      "alternateRoutes": "checked|not-applicable|blocked"
    },
    "impactElevation": {
      "performed": true,
      "strongestRealisticImpact": "...",
      "chainsTested": []
    },
    "realismCheck": {
      "scenario": "...",
      "configuration": "default|documented|normal-practice",
      "forcedConditions": []
    },
    "antiSlopCheck": "...",
    "deviations": [],
    "deviationRepair": null
  }
}
```

This is not a checkbox. Include short evidence of how the contract was followed.
If you deviated, name the deviation, repair it, and continue from the corrected
state.
