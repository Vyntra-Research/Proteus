# OpenCode Support

Proteus can be used directly inside OpenCode without enabling Chimera mode.
This integration installs project-local OpenCode assets:

- `opencode.json` with a local Proteus MCP server named `proteus`;
- `.opencode/commands/proteus.md` for the `/proteus` command;
- `.opencode/skills/proteus*/SKILL.md` for the coordinator and specialist skills;
- `.opencode/agents/proteus-*.md` for Proteus specialist subagents;
- `.opencode/templates/` with the packaged Proteus templates.

Install and configure OpenCode by following the official project:

- OpenCode repository: <https://github.com/anomalyco/opencode>
- OpenCode docs: <https://opencode.ai/docs/>

Then install Proteus support in a target workspace:

```powershell
proteus opencode install --root C:\path\to\target
proteus opencode doctor --root C:\path\to\target
```

Use `--force` only when you want Proteus to refresh existing generated files:

```powershell
proteus opencode install --root C:\path\to\target --force
```

## How OpenCode Loads It

OpenCode loads project config from `opencode.json` and discovers project-local
assets under `.opencode/`. The generated config enables the local MCP server:

```json
{
  "mcp": {
    "proteus": {
      "type": "local",
      "command": ["proteus-mcp"],
      "enabled": true,
      "timeout": 15000
    }
  },
  "instructions": [".opencode/instructions/proteus.md"],
  "permission": {
    "skill": {
      "proteus*": "allow"
    }
  }
}
```

The MCP server requires the Proteus runtime to be available on `PATH`.

## Usage

Inside OpenCode, start the coordinator with:

```text
/proteus initialize or resume research for this repository
```

The coordinator should load the `proteus` skill first, use MCP tools when
available, and fall back to the `proteus` CLI when needed. Specialist skills
are available as:

- `proteus-chaining`
- `proteus-codebase-research`
- `proteus-fuzzing`
- `proteus-web-intel`
- `proteus-web-research`
- `proteus-poc-exploit`
- `proteus-checkpoint`

Proteus specialist subagents are installed under `.opencode/agents/` and can be
invoked by OpenCode when the coordinator needs a bounded front. Keep assignments
specific: one surface, one objective, expected evidence, and kill criteria.

## Direct OpenCode vs Chimera

Direct OpenCode support makes the current OpenCode session Proteus-aware.
Chimera mode is separate. It lets a coordinator launch and manage additional
OpenCode-backed co-agents with Proteus-managed labs, messages, workflow
snapshots, and lifecycle controls.

Use direct OpenCode support when you want OpenCode itself to run Proteus. Use
Chimera when another coordinator needs to launch OpenCode co-agents.
