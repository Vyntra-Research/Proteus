#!/usr/bin/env node
import fs from "node:fs";

const args = process.argv.slice(2);

if (args.includes("--version")) {
  console.log("mock-opencode 0.0.0");
  process.exit(0);
}

if (args[0] !== "run") {
  console.error(`mock-opencode expected run, got ${args[0] ?? "none"}`);
  process.exit(2);
}

const fileIndex = args.indexOf("--file");
const promptPath = fileIndex >= 0 ? args[fileIndex + 1] : null;
const prompt = promptPath && fs.existsSync(promptPath)
  ? fs.readFileSync(promptPath, "utf8")
  : "";

const modelIndex = args.indexOf("--model");
const variantIndex = args.indexOf("--variant");
const agentIndex = args.indexOf("--agent");

const sessionID = `ses_mock_${process.env.PROTEUS_CHIMERA_SESSION_ID ?? "unknown"}`;
const text = JSON.stringify({
  ok: true,
  runtime: "mock-opencode",
  sessionId: process.env.PROTEUS_CHIMERA_SESSION_ID ?? null,
  accessMode: process.env.PROTEUS_CHIMERA_ACCESS_MODE ?? null,
  model: modelIndex >= 0 ? args[modelIndex + 1] : null,
  variant: variantIndex >= 0 ? args[variantIndex + 1] : null,
  agent: agentIndex >= 0 ? args[agentIndex + 1] : null,
  sawDossier: prompt.includes("Chimera Dossier"),
  sawContract: prompt.includes("Chimera Contract"),
  sawChat: prompt.includes("Shared Chimera chat")
});

console.log(JSON.stringify({
  type: "step_start",
  timestamp: Date.now(),
  sessionID,
  part: { type: "step-start" }
}));
console.log(JSON.stringify({
  type: "text",
  timestamp: Date.now(),
  sessionID,
  part: { type: "text", text }
}));
console.log(JSON.stringify({
  type: "step_finish",
  timestamp: Date.now(),
  sessionID,
  part: {
    type: "step-finish",
    reason: "stop",
    tokens: { total: 1, input: 1, output: 1, reasoning: 0 },
    cost: 0
  }
}));
