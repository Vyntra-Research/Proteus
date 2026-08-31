# Changelog

## 2.1.9 - 2026-08-31

### Fixed

- Added actionable duplicate warnings when hypotheses and branches match prior structured records.
- Flagged records with decisions newer than their last explicit status reconciliation.
- Returned the current status, linked decision IDs, and the correct typed update action without inferring status from decision text.
- Marked decisions as reconciled only after an explicit status update, including updates that keep the same status.

## 2.1.8 - 2026-08-29

### Fixed

- Added explicit, typed hypothesis status transitions to the CLI and MCP with complete normalized output and `fromStatus`/`toStatus` values.
- Kept hypothesis decisions append-only while documenting `discarded` as the canonical closed status for a disproved hypothesis.
- Added field-level checkpoint contract diagnostics when branch promotion or campaign completion fails closed.

## 2.1.7 - 2026-08-28

### Fixed

- Bounded campaign recovery output with compact records, independent cursors, explicit counts, and structured MCP content.
- Kept the latest checkpoint first and marked every shortened checkpoint field with its stored count.
- Rejected new campaign checkpoints whose mandatory contract signature is missing or incomplete.
- Marked historical incomplete checkpoint signatures as invalid without changing their stored evidence.
- Blocked branch promotion and campaign completion when the latest checkpoint is missing or noncompliant.
- Made decision recording append-only and removed decision-text keyword handling from status transitions and memory ranking.
- Added strict planner, surface, ROI, and agent-front metadata contracts with canonical surface hydration.
- Returned explicit `fromStatus` and `toStatus` values for branch transitions.

## 2.1.6 - 2026-08-28

### Fixed

- Declared the Codex MCP runtime inline while keeping the Claude Code MCP bundle separate.
- Copied Chimera skills into each session so session changes and cleanup cannot affect installed skill sources.
- Added release and smoke checks for the Codex MCP declaration and isolated Chimera skill copies.

## 2.1.5 - 2026-08-25

### Fixed

- Refreshed local research files before duplicate queries so new findings and reports cannot remain outside the index.
- Ranked full-text results by relevance and collapsed repeated entity and source-path revisions.
- Replaced stale FTS rows on record updates and added a migration that removes existing duplicates.
- Scored prior coverage within local text windows and returned the matching passage instead of the start of a long document.
- Included discarded work, research logs, candidate registers, watchlists, surfaces, hypotheses, branches, and decisions in prior-coverage checks.

### Changed

- Added mandatory depth coverage, impact elevation, and realistic-scenario checks to the base, coordinator, specialist, and Chimera contracts.
- Renamed the CLI package to `@vyntra-research/proteus` while keeping the `proteus` and `proteus-mcp` commands.

## 2.1.4 - 2026-07-14

### Fixed

- Preserved the runtime and database version when the MCP server runs from an isolated Claude Code or Codex plugin cache.

### Changed

- Made the MCP smoke test execute from an isolated packaged-plugin copy and assert the advertised server version.

## 2.1.3 - 2026-07-14

### Fixed

- Resolved the bundled Claude Code MCP runtime through `CLAUDE_PLUGIN_ROOT` so it starts from any workspace.

### Changed

- Documented automatic Claude Code plugin MCP startup and retained CLI registration as a manual fallback.
- Corrected Claude Code usage examples to the namespaced `/proteus:proteus` plugin command.
- Added release validation for the Claude Code plugin MCP path.

## 2.1.2 - 2026-07-13

### Fixed

- Started managed OpenCode servers without a visible Windows console window.
- Serialized managed OpenCode server startup across concurrent Chimera sessions.
- Kept fresh Chimera sessions in `starting` until the agent emits real progress instead of promoting them from PID or session-id presence alone.
- Rejected test-only `mock-opencode` commands from normal Chimera configuration and runtime use.

### Changed

- Isolated Chimera smoke-test port ranges and added hidden `.cmd` launcher and mock-command guard coverage.

## 2.1.1 - 2026-07-09

### Fixed

- Updated GitHub repository, marketplace, plugin metadata, and tarball install references for the `Vyntra-Research/Proteus` namespace.
- Made `proteus chimera snapshot` without `--body` read the latest agent-authored snapshot state instead of failing with a write-only usage error.
- Added MCP `proteus_chimera_latest_snapshot` for explicit read-only snapshot checks.

### Changed

- Clarified CLI help, Chimera docs, coordinator skill, and Chimera-agent skill wording around `poll`, `snapshot`, and `workflow-snapshot`.

## 2.1.0 - 2026-07-06

### Fixed

- Hardened `chimera workflow-snapshot` for long OpenCode sessions by exporting through temporary files instead of relying on subprocess stdout buffering.
- Clarified Chimera priority delivery results so OpenCode steer acceptance is not mistaken for semantic agent acknowledgement.
- Preserved latest control-message metadata in `notifications.json` even after the agent inbox is consumed.
- Added the missing `campaign close` usage line to CLI help.

### Added

- Added direct OpenCode project support through `proteus opencode install|doctor` and matching MCP tools.
- Added generated OpenCode assets for `/proteus`, Proteus coordinator/specialist skills, specialist subagents, templates, instructions, and local `proteus-mcp` wiring.

### Changed

- Clarified CLI, MCP, docs, and Chimera skill wording around agent-authored `chimera snapshot` versus coordinator `chimera workflow-snapshot`.

## 2.0.3 - 2026-06-29

### Fixed

- Changed Chimera list item hints so active sessions no longer display stopped-session resume guidance.
- Treated priority delivery as successful when a stopped session is queued and auto-wake starts cleanly.
- Reconciled stale attached OpenCode session ids from local Chimera session files before workflow snapshot export.
- Hardened `chimera workflow-snapshot` against transient OpenCode export failures with short retries, JSON recovery from noisy output, and more useful export diagnostics.
- Improved Chimera snapshot polling for large agent-authored snapshots by returning bounded previews plus the full `snapshot.md` path and body length metadata.

## 2.0.2 - 2026-06-29

### Fixed

- Removed the separate Chimera relay command surface. Direct single-recipient messages now use `chimera send`/`proteus_chimera_send` for coordinator-to-agent and agent-to-agent flows, with optional source metadata handled by the unified path.
- Changed Chimera `start` to auto-start OpenCode bootstrap by default and report `starting` during attachment instead of leaving new sessions in an ambiguous ready state.
- Added Chimera session recovery for stale or inconsistent pid, status, and OpenCode session attachment state, including `chimera recover` and MCP `proteus_chimera_recover`.
- Hardened `chimera run` so manual runs do not compete with sessions that are already starting or running, and added optional resume instructions through `--message`/`message`.
- Changed priority delivery for parked sessions to use compact wake behavior for queued messages instead of treating every priority message as a full research rerun.
- Changed OpenCode server selection to reuse an already healthy local OpenCode server in the managed range before starting a new one.
- Improved Chimera polling visibility with control status, priority-pending state, delivery state, and recommended next command.
- Added active Chimera session list filters through CLI `chimera list --active` and MCP `proteus_chimera_list active=true`.
- Collapsed parked, closed, killed, failed, timed-out, and legacy waiting Chimera session states into reusable `stopped` sessions with verdict details stored separately.
- Changed default Chimera list scope to sessions linked to active campaigns, including all active campaigns when more than one is open. Added campaign labels in list output and `--all`/`all=true` for historical sessions.
- Accepted prefixed numeric ids such as `B8` in CLI/MCP numeric-id parsing.

### Changed

- Updated coordinator and Chimera docs/skills to explain when to use `start`, `send`, `broadcast`, `poll`, `workflow-snapshot`, `recover`, `run`, `kill`, and `close`, including the difference between queued messages, priority wake, and `run --message` resume.
- Expanded CLI and MCP smoke coverage for auto-start, recovery, unified direct messaging, and prefixed branch ids.

## 2.0.0 - 2026-06-27

### Added

- Added optional Chimera mode for OpenCode-backed secondary agents managed by Proteus.
- Added Chimera CLI commands for config, doctor, start, swarm, council, send, broadcast, post, snapshot, workflow-snapshot, heartbeat, run, wake, attach-opencode, poll, list, kill, close, and stop-server.
- Added MCP tools matching the Chimera CLI control surface.
- Added SQLite-backed Chimera sessions and messages with mirrored `.vros/chimera` session files, labs, JSONL inbox/outbox, snapshots, kill flags, and OpenCode logs.
- Added coordinator-controlled Chimera access modes: default `explorer` and explicit `editor` per launched agent.
- Added `chimera-agent` skill for secondary agents, including communication commands, shared-chat broadcast, inbox polling, access-mode discipline, snapshots, heartbeat, and stop conditions.
- Added OpenCode doctor checks and mock-OpenCode smoke coverage so CI validates Chimera without requiring an API key.
- Added priority Chimera notifications for coordinator messages and broadcasts, plus a session-local `notifications.json` signal that running agents check periodically before polling Proteus.
- Added managed OpenCode server/session tracking for Chimera runs, `chimera run` reuse of existing labs, manual `attach-opencode`, and priority `delivery=steer` pings when an OpenCode session is attached.
- Added Chimera brainstorm councils with ordered turns, automatic cueing, exclusive council transcripts, and bounded close instructions.
- Added compact Chimera workflow snapshots that export recent OpenCode assistant messages while excluding user messages, tool calls, tool outputs, command output, patches, and file payloads.
- Added `proteus branch update` and MCP `proteus_update_branch` for correcting branch status directly, plus automatic branch-status updates when decisions are recorded against `hypothesis_branch` or `branch` records.
- Added a cross-process SQLite lock layer for Proteus writes so parallel Chimera agents and MCP/CLI calls coordinate through a single memory base more reliably.

### Changed

- Updated the main coordinator skill to explain when to use Chimera, how to check config, how to poll unread messages, and how to choose `explorer` versus `editor` access.
- Updated README and Chimera docs with the official OpenCode project link, GLM-style model/variant target config, CLI examples, swarm usage, MCP tools, broadcast chat, and access-mode guidance.
- Consolidated human docs by replacing redundant planning/update documents with the current technical Chimera reference.
- Expanded CLI and MCP smoke tests to cover Chimera config/start/post/poll/snapshot/workflow-snapshot/heartbeat/run/kill/close/swarm/council/direct-message flows, branch updates, no-timeout config, and MCP parity.

### Migration

- Existing `.vros/memory.sqlite` databases migrate automatically to add Chimera session and message tables when opened by Proteus 2.0.0. Proteus also checks the recorded migration ids, so a database stamped with the current runtime version still receives any missing idempotent migrations.
- Chimera remains disabled by default. Normal Proteus CLI/MCP usage does not require OpenCode.

## 1.0.3 - 2026-06-23

### Fixed

- Fixed MCP `evidenceIds` parsing for decisions and validation gates when agents send numeric IDs as strings, such as `["434"]`, or comma-separated strings.
- Updated MCP schemas to advertise numeric evidence ID arrays while keeping compatibility with numeric-string inputs.
- Added MCP smoke coverage so high-impact decisions with numeric-string evidence IDs do not trigger false `decision_without_evidence` advisories.
## 1.0.2 - 2026-06-22

### Added

- Added `proteus merge` and MCP `proteus_merge_memory` to merge one or more Proteus `.vros/memory.sqlite` bases into a destination workspace root.
- Merge accepts source workspace roots, `.vros` directories, or direct `.vros/memory.sqlite` paths, with `--dry-run` support for safe previews.
- Merge remaps copied campaign, round, surface, hypothesis, evidence, branch, checkpoint, link, gate, decision, and FTS references into the destination database.

### Changed

- Strengthened the base research contract and coordinator skill to prefer the actual workspace root for Proteus memory unless explicitly instructed otherwise.
- Documented recovery examples for merging accidental subfolder `.vros` bases back into the correct workspace root.

## 1.0.0 - 2026-06-17

### Added

- Campaign-scoped research state with create, resume, checkpoint, close, digest, events, and entity links.
- Hypothesis branches for explicit creative attack paths, ROI scoring, preconditions, success criteria, kill conditions, and branch status.
- Structured campaign checkpoints with confirmed, killed, open, pivots, score changes, context compression, next high-ROI move, and contract signature fields.
- MCP response envelopes with advisories, related records, suggested reads, and state deltas.
- Deterministic similarity query that separates duplicate/report coverage from broader memory matches.
- Auto-linking from the single active campaign to newly recorded hypotheses, evidence, decisions, validation gates, and specialist outputs.
- Database-level Proteus version metadata so automatic migrations run only when the stored base version is missing or differs from the runtime version.
- Modular Proteus skills for chaining, fuzzing, codebase research, web intel, web research, PoC/exploit work, and checkpoints.
- Expanded individual skill contracts with professional heuristics for non-obvious chaining, calibrated fuzzing, active codebase learning, realistic PoCs, and intelligence-driven pivots.
- Strengthened report-writing guidance to follow supplied templates, avoid artificial checklist/legalistic prose, and write concise triage-ready summaries for readers with no prior context.
- Added report anti-pattern guardrails for common LLM phrasing, defensive caveats, Impact-section reframing, verbose reproduction steps, local workspace leakage, and adjustment replies that are not written for an external triager.
- Cicada specialist role for advanced exploit development, bypass work, and chaining on already-promising targets.
- Shared base research contract requiring realistic exploitability, anti-slop validation, dedupe, public-known checks, and explicit contract attestation.
- GitHub Actions CI and tag-based release automation for `v*` tags.

### Changed

- Strengthened coordinator and specialist prompts around Tree-of-Thoughts style branching, ROI ranking, validation gates, reflection checkpoints, and evidence-backed decisions.
- Updated README and architecture docs to explain plugin, CLI, MCP runtime, campaigns, branches, checkpoints, and release behavior.
- Expanded CLI and MCP smoke coverage to exercise campaigns, branches, checkpoints, links, similarity, migration, and MCP state recovery.
- Updated release automation so GitHub Release notes are copied from the matching `CHANGELOG.md` version section, and merges to `main` create the version tag/release when the tag is missing.
- Clarified that Codex users should invoke the plugin with `@proteus`, while `/proteus` is the Claude Code slash command.
- Made checkpoint contract-signature parsing friendlier to Windows shells by accepting comma-separated `key=value` pairs in addition to JSON.
- Changed release-note generation so a missing changelog section for a new version reuses the latest version notes instead of falling back to commit summaries.

### Migration

- Added transactional, idempotent schema migrations with recorded migration versions.
- Added `proteus_metadata` with `proteus_version` tracking for migration gating and status reporting.
- Existing `.vros/memory.sqlite` databases are migrated automatically when opened by the new runtime.
- Added explicit `proteus migrate --root <target>` and migration status reporting.

### Deferred

- Chimera/Claude hybrid mode remains intentionally deferred to a later update.
