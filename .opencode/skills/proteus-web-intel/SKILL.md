---
name: proteus-web-intel
description: Gather Proteus security intelligence for known status, timelines, advisories, changelogs, docs, and duplicate risk.
compatibility: opencode
metadata:
  source: proteus
---

# Proteus Web Intel

Use this skill to learn what the researcher does not yet know. Intel is not a
checkbox. It should actively change the map: kill duplicates, reveal expected
behavior, identify version windows, explain maintainer intent, and suggest
better pivots.

Follow the Proteus base research contract. Prefer primary sources and record
exact queries, dates, links, and conclusions.

## Operating Method

1. State the claim or uncertainty being checked.
2. Search local memory first: findings, reports, discarded paths, decisions,
   gates, watchlists, and campaign branches.
3. Search primary public sources: official docs, changelogs, releases,
   advisories, CVE/GHSA records, issues, PRs, tests, commits, migration docs,
   and maintainer comments.
4. Build a timeline: likely introduction, affected versions, fix or non-fix
   status, regression windows, and current-version relevance.
5. Decide whether the branch is duplicate, expected behavior, known but
   under-exploited, fixed, incomplete fix, regression, or still novel enough to
   test.
6. Feed discoveries back into codebase/chaining/fuzzing. Good intel should
   create sharper probes, not just citations.

## Source Heuristics

- Prefer docs/tests/maintainer discussion over blog summaries.
- Treat TODO/FIXME and known fixes as learning material first, bounty target
  second.
- Absence of public discussion is not proof of novelty.
- A known issue can still be useful if there is concrete evidence of bypass,
  incomplete fix, regression, unsupported but reachable mode, or a materially
  stronger chain.
- Record expected behavior clearly. If the target intentionally supports the
  behavior, route to chaining only if side effects cross a security boundary.

## Anti-Patterns

- Do not stop after one search query.
- Do not use public exploit writeups as a substitute for target-specific root
  cause.
- Do not claim "not known" without documented search coverage.
- Do not let intel become procrastination. Once the timeline and duplicate risk
  are clear enough, return to testing.

Required output:

```json
{
  "checkedClaim": "...",
  "localMemoryDedupe": [],
  "expectedBehavior": "...",
  "knownIssues": [],
  "timeline": {
    "introduced": "...",
    "affectedVersions": [],
    "fixedOrDocumented": "...",
    "currentVersionRelevance": "..."
  },
  "duplicateRisk": "low|medium|high|confirmed",
  "intelVerdict": "kill|watch|continue|reframe|send-to-chaining|send-to-poc",
  "researchPivots": [],
  "queriesAndSources": [],
  "contractSignature": {}
}
```
