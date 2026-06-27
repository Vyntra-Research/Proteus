# Chimera Dogfood Follow-ups

Temporary scratchpad for non-critical Proteus improvements observed during the practical Chimera run against `C:\Users\rafae\Desktop\bbps\vercel\next.js`.

## Resolved in current patch

- Chimera co-agent skill examples needed explicit `--root <workspace-root>` on CLI communication commands.
- `chimera start --run` did not expose a live run PID that `chimera kill` could stop. The runner now writes `opencode.pid`, watches `kill.flag`, and the smoke test validates killing an active mock run.
- `chimera workflow-snapshot` returned `messages: []` for OpenCode 1.17.11 exports. The parser now handles `messages[].info.role`, `messages[].parts[]`, skips synthetic/tool content, and keeps compact assistant text.
- On Windows PowerShell, generated Chimera command examples that start with a quoted absolute `node.exe` path need the `&` call operator. Runtime-generated commands now include it on Windows.

## Remaining non-critical follow-ups

- `chimera list --json` currently prints `provider: "high"` for sessions launched with `--variant high`. This appears to be the OpenCode variant being exposed under a confusing field name. Prefer explicit `variant` in JSON output, and only expose `provider` when it is a real provider value.
- Each Chimera session currently creates a local `.opencode/node_modules` tree. Recursive inspection of a session directory becomes extremely noisy and can flood the coordinator context. Add an ignore/exclude helper, a concise `chimera inspect` command, or make workflow snapshots/listing skip `.opencode/node_modules` by default.
- Priority `chimera send` records coordinator messages correctly, but direct delivery reports `attempted: false` when `opencodeSessionId` is missing. This means live steering silently degrades to inbox polling. Make the missing session id highly visible in `chimera list/poll`, and recover/attach it automatically when possible.
- `chimera workflow-snapshot --id CH-0001/CH-0002` fails with `has no attached OpenCode session id` even though `opencode run` processes are alive. `start --run` should attach the OpenCode session id automatically or provide a clear `chimera attach-opencode` recovery command in the error output.
- `proteus chimera --help` only lists `attach-opencode` in the fallback error usage, not in the primary usage block or examples. Add explicit help for `chimera attach-opencode --id <CH-id> --server-url <url> --opencode-session-id <session-id>`.
- During R97, CH-0001 drifted back into the well-covered `nxtP*` / CVE-2026-44574 family despite the goal asking for not-fully-tested low-level chains. Strengthen the co-agent dossier with an explicit "hard avoid / already covered" section sourced from recent Proteus memory, and tell agents to kill attractive duplicate neighborhoods before deep code reading unless they can name the new root-cause delta first.
