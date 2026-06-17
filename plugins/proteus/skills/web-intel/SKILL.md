---
name: web-intel
description: Gather expected-behavior, changelog, advisory, issue, PR, and maintainer-context intelligence for Proteus hypotheses.
---

# Proteus Web Intel

Use this skill when a hypothesis needs external context, duplicate risk, or
expected-behavior validation.

Follow the Proteus base research contract. Prefer primary sources:

- official docs;
- changelogs and release notes;
- advisories;
- issues and PRs with maintainer comments;
- tests added with fixes;
- migration or breaking-change docs.

Required output:

```json
{
  "expectedBehavior": "...",
  "knownIssues": [],
  "recentChanges": [],
  "securityRelevantDiffs": [],
  "duplicateRisk": "...",
  "researchPivots": [],
  "queriesAndSources": [],
  "contractSignature": {}
}
```

Do not treat absence of public discussion as proof of vulnerability.
