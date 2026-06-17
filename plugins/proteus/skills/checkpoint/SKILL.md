---
name: checkpoint
description: Compress Proteus campaign or round state after meaningful progress, preserving confirmed facts, killed paths, pivots, branch scores, learned heuristics, unresolved blockers, and the next high-ROI move.
---

# Proteus Checkpoint

Use this skill every 3-5 meaningful steps, at the end of a front, after a
branch score changes, or whenever campaign state risks drifting. A checkpoint is
not a diary entry. It is an operational map update that should make the next
researcher faster and less likely to repeat weak work.

Follow the Proteus base research contract. Keep the output compact enough for
campaign memory, but precise enough to steer future decisions.

## Method

1. Separate confirmed facts from interpretations.
2. Record killed paths with the reason they died and what evidence would reopen
   them.
3. Preserve open branches with current blocker, next probe, and ROI change.
4. Capture unexpected lessons: input reactions, side effects, component
   couplings, docs/implementation drift, or failed assumptions.
5. Name pivots explicitly. A pivot should say what new fact changed the plan.
6. Choose one next high-ROI move. Avoid vague "continue analysis" language.
7. Include a contract signature that states how dedupe, expected behavior,
   attacker model, and anti-slop checks were maintained.

## Anti-Patterns

- Do not summarize everything equally. Prioritize decision-changing facts.
- Do not bury killed paths; future agents need to see why they are dead.
- Do not leave "interesting" notes unlinked to a branch, surface, evidence,
  decision, or revisit condition.
- Do not mark a branch killed only because the first framing was weak. If
  chaining or Cicada could plausibly improve it, record that handoff instead.

Required output:

```json
{
  "confirmed": [],
  "killed": [
    {
      "branch": "...",
      "reason": "...",
      "reopenIf": "..."
    }
  ],
  "open": [
    {
      "branch": "...",
      "currentBlocker": "...",
      "nextProbe": "...",
      "roiChange": "up|down|same"
    }
  ],
  "pivots": [],
  "scoreChanges": [],
  "contextToPersist": [],
  "nextHighRoiMove": "...",
  "recordsToLink": [],
  "contractSignature": {}
}
```

Record the checkpoint through Proteus campaign tools when available.
