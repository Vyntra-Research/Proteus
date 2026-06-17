---
name: web-research
description: Conduct authorized web application research for Proteus targets using the same campaign, chaining, fuzzing, intel, and PoC heuristics adapted to live or local web surfaces. Use for endpoint behavior mapping, blackbox probes, browser/API workflows, and web pentest-style validation.
---

# Proteus Web Research

Use this skill for authorized web-facing surfaces. The goal is to learn how the
application behaves through realistic blackbox and graybox interaction, then
feed that learning into chaining, fuzzing, Cicada, or PoC validation.

Follow the Proteus base research contract. Respect scope, rate limits, and
program rules. Prefer local or explicitly authorized targets for active probes.

## Operating Method

1. Define scope, identity context, and attacker capability before probing.
2. Map workflows, not just endpoints: authentication, authorization, object
   ownership, state changes, uploads/downloads, callbacks, webhooks, imports,
   exports, background jobs, cacheable responses, and client/server divergence.
3. Use low-noise blackbox probes to learn reactions. Record status codes,
   headers, redirects, body differences, cookies, cache behavior, side effects,
   async events, and server/client disagreement.
4. Turn observations into branches: what state changed, what component consumed
   it, what authority decision could drift, what invariant was assumed?
5. Hand narrow input-reaction questions to `fuzzing`; hand side-effect chains to
   `chaining`; hand concrete blockers to Cicada; hand novelty/timeline questions
   to `web-intel`.

## Web Heuristics

- Think in workflows and state, not isolated requests.
- Compare roles, tenants, projects, sessions, browsers, runtimes, and replayed
  requests only where scope permits.
- Look for hidden side effects: queued jobs, generated previews, cache entries,
  webhooks, notifications, audit logs, exports, derived files, and delayed
  cleanup.
- Track interpretation drift between browser, API, edge/cache, backend, worker,
  storage, and third-party integrations.
- Prefer manual, readable probes before automation. Automation should preserve
  the story of the attack.

## Anti-Patterns

- Do not spray generic payloads or scanner checks.
- Do not treat 500s, noisy errors, or cosmetic client bugs as findings without
  root cause and realistic impact.
- Do not escalate probe intensity without evidence that the branch is worth it.
- Do not ignore boring observations; they may be map data for later chaining.

Required output:

```json
{
  "scopeAndAttackerModel": "...",
  "workflowMap": [],
  "observedBehaviors": [],
  "stateAndSideEffects": [],
  "trustBoundaries": [],
  "candidateBranches": [],
  "probesRun": [],
  "negativeControls": [],
  "handoffs": [],
  "memoryToRecord": [],
  "contractSignature": {}
}
```
