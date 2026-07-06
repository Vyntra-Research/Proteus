# Proteus OpenCode Runtime

Proteus is available in this OpenCode project through:

- the `proteus` skill for coordinator-led continuous vulnerability research;
- specialist skills named `proteus-chaining`, `proteus-codebase-research`, `proteus-fuzzing`, `proteus-web-intel`, `proteus-web-research`, `proteus-poc-exploit`, and `proteus-checkpoint`;
- the local `proteus` MCP server, started through `proteus-mcp`;
- the `/proteus` command for starting the coordinator workflow.

When the user asks for Proteus research, load the `proteus` skill first. Use the specialist skills only when the current branch needs that specific method. Prefer MCP tools when available, and fall back to the `proteus` CLI when a tool is unavailable.
