#!/usr/bin/env node
import fs from "node:fs";

const args = process.argv.slice(2);

if (args.includes("--version")) {
  console.log("mock-goose 0.0.0");
  process.exit(0);
}

if (args[0] !== "run") {
  console.error(`mock-goose expected run, got ${args[0] ?? "none"}`);
  process.exit(2);
}

const instructionsIndex = args.indexOf("--instructions");
const instructionsPath = instructionsIndex >= 0 ? args[instructionsIndex + 1] : null;
const instructions = instructionsPath && fs.existsSync(instructionsPath)
  ? fs.readFileSync(instructionsPath, "utf8")
  : "";

console.log(JSON.stringify({
  ok: true,
  runtime: "mock-goose",
  sessionId: process.env.PROTEUS_CHIMERA_SESSION_ID ?? null,
  accessMode: process.env.PROTEUS_CHIMERA_ACCESS_MODE ?? null,
  sawDossier: instructions.includes("Chimera Dossier"),
  sawContract: instructions.includes("Chimera Contract")
}));
