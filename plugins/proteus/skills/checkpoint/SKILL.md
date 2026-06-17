---
name: checkpoint
description: Compress Proteus campaign or round state after meaningful progress, preserving confirmed facts, killed paths, pivots, branch scores, and next high-ROI moves.
---

# Proteus Checkpoint

Use this skill every 3-5 meaningful steps, at the end of a front, or whenever
the campaign state risks drifting.

Follow the Proteus base research contract. The output should be short enough to
be useful as campaign memory.

Required output:

```json
{
  "confirmed": [],
  "killed": [],
  "open": [],
  "pivots": [],
  "scoreChanges": [],
  "contextToPersist": [],
  "nextHighRoiMove": "...",
  "contractSignature": {}
}
```

Record the checkpoint through Proteus campaign tools when available.
