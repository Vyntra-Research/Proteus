import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ProteusDb, type ChimeraMessageRow, type ChimeraSessionRow } from "./db";
import { chimeraDir, chimeraSessionDir, chimeraSessionsDir, ensureDir, toRelative } from "./paths";
import type {
  ChimeraConfig,
  ChimeraAccessMode,
  ChimeraMessageKind,
  ChimeraStatus,
  JsonValue
} from "./types";

export const DEFAULT_CHIMERA_CONFIG: ChimeraConfig = {
  enabled: false,
  runtime: "opencode",
  opencodeCommand: "opencode",
  defaultModel: null,
  defaultVariant: null,
  defaultAgent: "proteus-chimera",
  maxAgents: 4,
  defaultTimeoutSec: 900,
  defaultNetwork: false,
  skipPermissions: true
};

export interface ChimeraStartInput {
  role: string;
  goal: string;
  accessMode?: ChimeraAccessMode;
  accessNotes?: string;
  campaignId?: number;
  roundId?: number;
  model?: string;
  provider?: string;
  variant?: string;
  timeoutSec?: number;
  run?: boolean;
}

export interface ChimeraSwarmPlan {
  campaignId?: number;
  roundId?: number;
  run?: boolean;
  agents: Array<{
    role: string;
    goal: string;
    accessMode?: ChimeraAccessMode;
    accessNotes?: string;
    model?: string;
    provider?: string;
    variant?: string;
  }>;
}

export function initChimeraConfig(db: ProteusDb, input: Partial<ChimeraConfig> = {}): ChimeraConfig {
  const current = db.getChimeraConfig() ?? DEFAULT_CHIMERA_CONFIG;
  const next: ChimeraConfig = {
    enabled: input.enabled ?? true,
    runtime: "opencode",
    opencodeCommand: stringOr(input.opencodeCommand, current.opencodeCommand),
    defaultModel: nullableString(input.defaultModel, current.defaultModel),
    defaultVariant: nullableString(input.defaultVariant, current.defaultVariant),
    defaultAgent: nullableString(input.defaultAgent, current.defaultAgent),
    maxAgents: positiveInteger(input.maxAgents, current.maxAgents),
    defaultTimeoutSec: positiveInteger(input.defaultTimeoutSec, current.defaultTimeoutSec),
    defaultNetwork: input.defaultNetwork ?? current.defaultNetwork,
    skipPermissions: input.skipPermissions ?? current.skipPermissions
  };
  saveChimeraConfig(db, next);
  return next;
}

export function saveChimeraConfig(db: ProteusDb, config: ChimeraConfig): void {
  db.saveChimeraConfig(config);
  ensureDir(chimeraDir(db.targetRoot));
  fs.writeFileSync(path.join(chimeraDir(db.targetRoot), "config.json"), JSON.stringify(config, null, 2) + "\n");
}

export function getChimeraConfig(db: ProteusDb): ChimeraConfig {
  return db.getChimeraConfig() ?? DEFAULT_CHIMERA_CONFIG;
}

export function chimeraDoctor(db: ProteusDb): {
  ok: boolean;
  config: ChimeraConfig;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
} {
  const config = getChimeraConfig(db);
  ensureDir(chimeraDir(db.targetRoot));
  const checks = [
    {
      name: "enabled",
      ok: config.enabled,
      detail: config.enabled ? "Chimera is enabled." : "Run proteus chimera config init before starting agents."
    },
    {
      name: "chimera_dir",
      ok: canWriteDir(chimeraDir(db.targetRoot)),
      detail: chimeraDir(db.targetRoot)
    },
    {
      name: "skills",
      ok: resolveSkillsDir() !== null,
      detail: resolveSkillsDir() ?? "Could not resolve plugins/proteus/skills."
    },
    commandCheck("opencode", config.opencodeCommand, ["--version"]),
    commandCheck("proteus_cli", process.execPath, [resolveProteusCliPath(), "--version"])
  ];
  return { ok: checks.every((check) => check.ok), config, checks };
}

export function startChimeraSession(db: ProteusDb, input: ChimeraStartInput): {
  session: ChimeraSessionRow;
  config: ChimeraConfig;
  paths: ChimeraPaths;
  run?: ChimeraRunResult;
  nextSuggestedReads: string[];
} {
  if (!input.role?.trim()) throw new Error("Missing Chimera role.");
  if (!input.goal?.trim()) throw new Error("Missing Chimera goal.");
  const config = getChimeraConfig(db);
  if (!config.enabled) {
    throw new Error("Chimera is disabled. Run `proteus chimera config init` first.");
  }
  const publicId = nextPublicId(db);
  const sessionDir = chimeraSessionDir(db.targetRoot, publicId);
  const labDir = path.join(sessionDir, "lab");
  const session = db.createChimeraSession({
    publicId,
    campaignId: input.campaignId ?? null,
    roundId: input.roundId ?? null,
    role: input.role.trim(),
    goal: input.goal.trim(),
    accessMode: input.accessMode ?? "lab",
    accessNotes: input.accessNotes ?? null,
    model: input.model ?? config.defaultModel,
    provider: normalizeOpenCodeVariant(input.variant, input.provider, config.defaultVariant),
    sessionDir,
    labDir,
    opencodeCommand: config.opencodeCommand
  });
  const paths = createSessionFiles(db, session, config);
  db.addChimeraMessage({
    publicId: session.publicId,
    direction: "system",
    kind: "message",
    body: `Chimera session started for role ${session.role}.`,
    metadata: { sessionDir: toRelative(db.targetRoot, session.sessionDir) },
    readByAgent: true,
    readByCoordinator: true
  });
  const linked = linkChimeraSession(db, session);
  let updated = db.updateChimeraSession({ publicId: session.publicId, status: input.run ? "running" : "waiting" });
  writeStatusFile(db, updated, { linked });
  let run: ChimeraRunResult | undefined;
  if (input.run) {
    run = runOpenCodeOnce(db, updated, paths.promptPath, config, input.timeoutSec ?? config.defaultTimeoutSec);
    updated = db.updateChimeraSession({
      publicId: session.publicId,
      status: run.exitCode === 0 ? "waiting" : run.timedOut ? "timeout" : "failed"
    });
    writeStatusFile(db, updated, { linked, lastRun: run });
  }
  return {
    session: updated,
    config,
    paths,
    run,
    nextSuggestedReads: [
      `proteus chimera poll --id ${session.publicId} --unread`,
      `proteus chimera send --id ${session.publicId} --message "..."`
    ]
  };
}

export function sendChimeraMessage(db: ProteusDb, publicId: string, body: string, kind: ChimeraMessageKind = "message"): ChimeraMessageRow {
  const message = db.addChimeraMessage({
    publicId,
    direction: "coordinator_to_agent",
    kind,
    body,
    readByCoordinator: true,
    readByAgent: false
  });
  appendJsonl(inboxPath(db, publicId), message);
  return message;
}

export function broadcastChimeraMessage(db: ProteusDb, input: {
  body: string;
  kind?: ChimeraMessageKind;
  fromId?: string;
  includeClosed?: boolean;
}): {
  delivered: ChimeraMessageRow[];
  skipped: Array<{ publicId: string; reason: string }>;
} {
  const fromId = input.fromId?.trim();
  const sessions = db.listChimeraSessions({ limit: 500 });
  const delivered: ChimeraMessageRow[] = [];
  const skipped: Array<{ publicId: string; reason: string }> = [];
  for (const session of sessions.reverse()) {
    if (fromId && session.publicId === fromId) {
      skipped.push({ publicId: session.publicId, reason: "source session" });
      continue;
    }
    if (!input.includeClosed && ["closed", "failed", "killed", "timeout"].includes(session.status)) {
      skipped.push({ publicId: session.publicId, reason: `status ${session.status}` });
      continue;
    }
    const message = db.addChimeraMessage({
      publicId: session.publicId,
      direction: "coordinator_to_agent",
      kind: input.kind ?? "message",
      body: input.body,
      metadata: { broadcast: true, fromId: fromId ?? "coordinator" },
      readByCoordinator: true,
      readByAgent: false
    });
    appendJsonl(inboxPath(db, session.publicId), message);
    delivered.push(message);
  }
  if (fromId) {
    postChimeraMessage(db, fromId, "message", `Broadcast delivered to ${delivered.length} Chimera session(s).`, {
      broadcast: true,
      deliveredTo: delivered.map((message) => message.publicId),
      skipped
    });
  }
  return { delivered, skipped };
}

export function postChimeraMessage(db: ProteusDb, publicId: string, kind: ChimeraMessageKind, body: string, metadata?: JsonValue): ChimeraMessageRow {
  const message = db.addChimeraMessage({
    publicId,
    direction: "agent_to_coordinator",
    kind,
    body,
    metadata,
    readByCoordinator: false,
    readByAgent: true
  });
  appendJsonl(outboxPath(db, publicId), message);
  return message;
}

export function snapshotChimeraSession(db: ProteusDb, publicId: string, body: string): ChimeraMessageRow {
  const session = requireChimeraSession(db, publicId);
  fs.writeFileSync(path.join(session.sessionDir, "snapshot.md"), body.trimEnd() + "\n");
  const message = postChimeraMessage(db, publicId, "snapshot", body);
  writeStatusFile(db, session, { latestSnapshotAt: message.createdAt });
  return message;
}

export function heartbeatChimeraSession(db: ProteusDb, publicId: string): {
  alive: boolean;
  killed: boolean;
  session: ChimeraSessionRow;
  killReason?: string;
} {
  const current = requireChimeraSession(db, publicId);
  const killPath = path.join(current.sessionDir, "kill.flag");
  const killed = fs.existsSync(killPath);
  const session = db.updateChimeraSession({ publicId, status: killed ? "killed" : current.status === "starting" ? "running" : current.status });
  if (!killed) {
    db.addChimeraMessage({
      publicId,
      direction: "agent_to_coordinator",
      kind: "heartbeat",
      body: "Agent heartbeat.",
      readByAgent: true
    });
  }
  writeStatusFile(db, session);
  return {
    alive: !killed && session.status !== "closed" && session.status !== "failed" && session.status !== "timeout",
    killed,
    session,
    killReason: killed ? fs.readFileSync(killPath, "utf8") : undefined
  };
}

export function pollChimeraMessages(db: ProteusDb, input: {
  publicId?: string;
  unreadOnly?: boolean;
  forAgent?: boolean;
  peek?: boolean;
  limit?: number;
}): {
  sessions: ChimeraSessionRow[];
  messages: ChimeraMessageRow[];
  latestSnapshots: Array<{ publicId: string; body: string; createdAt: string }>;
} {
  const unreadFor = input.unreadOnly ? (input.forAgent ? "agent" : "coordinator") : undefined;
  const messages = db.listChimeraMessages({
    publicId: input.publicId,
    unreadFor,
    limit: input.limit
  });
  if (input.unreadOnly && !input.peek) {
    db.markChimeraMessagesRead(messages.map((message) => message.id), input.forAgent ? "agent" : "coordinator");
  }
  const sessions = input.publicId
    ? [requireChimeraSession(db, input.publicId)]
    : db.listChimeraSessions({ limit: 50 });
  const latestSnapshots = sessions
    .map((session) => db.latestChimeraSnapshot(session.publicId))
    .filter((message): message is ChimeraMessageRow => message !== null)
    .map((message) => ({ publicId: message.publicId, body: message.body, createdAt: message.createdAt }));
  return { sessions, messages, latestSnapshots };
}

export function killChimeraSession(db: ProteusDb, publicId: string, reason: string): ChimeraSessionRow {
  const session = requireChimeraSession(db, publicId);
  fs.writeFileSync(path.join(session.sessionDir, "kill.flag"), reason.trimEnd() + "\n");
  db.addChimeraMessage({
    publicId,
    direction: "coordinator_to_agent",
    kind: "kill",
    body: reason,
    readByCoordinator: true
  });
  if (session.opencodePid) {
    try {
      process.kill(session.opencodePid);
    } catch {
      // The process may have already exited. The kill flag remains authoritative.
    }
  }
  const updated = db.updateChimeraSession({ publicId, status: "killed", closeVerdict: "kill", closeSummary: reason });
  writeStatusFile(db, updated, { killReason: reason });
  return updated;
}

export function closeChimeraSession(db: ProteusDb, publicId: string, verdict: string, summary: string): {
  session: ChimeraSessionRow;
  agentOutputId: number | null;
} {
  const current = requireChimeraSession(db, publicId);
  const updated = db.updateChimeraSession({ publicId, status: "closed", closeVerdict: verdict, closeSummary: summary });
  db.addChimeraMessage({
    publicId,
    direction: "system",
    kind: "close",
    body: summary,
    metadata: { verdict },
    readByAgent: true,
    readByCoordinator: true
  });
  let agentOutputId: number | null = null;
  if (current.roundId) {
    agentOutputId = db.addAgentOutput({
      roundId: current.roundId,
      codename: "cicada",
      roleFamily: `chimera:${current.role}`,
      assignedSurface: current.goal,
      outputPath: toRelative(db.targetRoot, path.join(current.sessionDir, "snapshot.md")),
      coveredSurface: [],
      liveCandidates: verdict === "useful" || verdict === "lab-needed" ? [summary] : [],
      killedHypotheses: verdict === "kill" ? [summary] : [],
      probes: [],
      uncoveredAreas: [],
      validationStatus: verdict
    });
  }
  writeStatusFile(db, updated, { verdict, summary, agentOutputId });
  return { session: updated, agentOutputId };
}

export function startChimeraSwarm(db: ProteusDb, plan: ChimeraSwarmPlan): {
  sessions: Array<ReturnType<typeof startChimeraSession>>;
  maxAgents: number;
} {
  const config = getChimeraConfig(db);
  if (!Array.isArray(plan.agents) || plan.agents.length === 0) throw new Error("Swarm plan must include at least one agent.");
  if (plan.agents.length > config.maxAgents) {
    throw new Error(`Swarm plan has ${plan.agents.length} agents, but config maxAgents is ${config.maxAgents}.`);
  }
  const sessions = plan.agents.map((agent) =>
    startChimeraSession(db, {
      role: agent.role,
      goal: agent.goal,
      accessMode: agent.accessMode,
      accessNotes: agent.accessNotes,
      campaignId: plan.campaignId,
      roundId: plan.roundId,
      model: agent.model,
      provider: agent.provider,
      variant: agent.variant,
      run: plan.run
    })
  );
  return { sessions, maxAgents: config.maxAgents };
}

interface ChimeraPaths {
  sessionDir: string;
  labDir: string;
  dossierPath: string;
  promptPath: string;
  contractPath: string;
  instructionsPath: string;
}

interface ChimeraRunResult {
  exitCode: number | null;
  timedOut: boolean;
  stdoutPath: string;
  stderrPath: string;
  runPath: string;
  stdoutPreview: string;
  stderrPreview: string;
}

function createSessionFiles(db: ProteusDb, session: ChimeraSessionRow, config: ChimeraConfig): ChimeraPaths {
  ensureDir(chimeraSessionsDir(db.targetRoot));
  ensureDir(session.sessionDir);
  ensureDir(session.labDir);
  for (const dir of ["poc", "scripts", "evidence"]) ensureDir(path.join(session.labDir, dir));
  const opencodeDir = path.join(session.sessionDir, "opencode");
  ensureDir(opencodeDir);
  ensureDir(path.join(session.sessionDir, "skills"));
  ensureDir(path.join(session.sessionDir, ".opencode", "agents"));
  ensureDir(path.join(session.sessionDir, ".opencode", "skills"));
  const target = db.getTarget();
  const contract = renderContract(db, session, config);
  const instructions = renderAgentInstructions(db, session);
  const dossier = renderDossier(db, session, target?.name ?? "unknown target");
  const prompt = [dossier, contract, instructions].join("\n\n");
  const paths = {
    sessionDir: session.sessionDir,
    labDir: session.labDir,
    dossierPath: path.join(session.sessionDir, "dossier.md"),
    promptPath: path.join(opencodeDir, "prompt.md"),
    contractPath: path.join(session.sessionDir, "contract.md"),
    instructionsPath: path.join(session.sessionDir, "agent-instructions.md")
  };
  fs.writeFileSync(paths.dossierPath, dossier);
  fs.writeFileSync(paths.contractPath, contract);
  fs.writeFileSync(paths.instructionsPath, instructions);
  fs.writeFileSync(paths.promptPath, prompt);
  fs.writeFileSync(path.join(session.labDir, "README.md"), renderLabReadme(session));
  fs.writeFileSync(path.join(session.labDir, "notes.md"), `# ${session.publicId} Notes\n\n`);
  for (const jsonl of ["inbox.jsonl", "outbox.jsonl", "transcript.jsonl"]) fs.writeFileSync(path.join(session.sessionDir, jsonl), "");
  copySkillFiles(session);
  writeOpenCodeAgentFile(session, config);
  return paths;
}

function runOpenCodeOnce(db: ProteusDb, session: ChimeraSessionRow, promptPath: string, config: ChimeraConfig, timeoutSec: number): ChimeraRunResult {
  const opencodeDir = path.join(session.sessionDir, "opencode");
  const stdoutPath = path.join(opencodeDir, "stdout.log");
  const stderrPath = path.join(opencodeDir, "stderr.log");
  const runPath = path.join(opencodeDir, "run.json");
  const args = [
    "run",
    "--format",
    "json",
    "--thinking",
    "--dir",
    session.sessionDir,
    "--file",
    promptPath,
    "--title",
    `proteus-${session.publicId}`,
    "--agent",
    config.defaultAgent ?? "proteus-chimera"
  ];
  if (session.model) args.push("--model", session.model);
  if (session.provider) args.push("--variant", session.provider);
  if (config.skipPermissions) args.push("--dangerously-skip-permissions");
  args.push(`Run the attached Proteus Chimera dossier for ${session.publicId}. Start by loading available Proteus skills if the skill tool is available, then execute only the assigned goal. Poll Proteus messages before long work and post a concise final snapshot.`);
  const startedAt = new Date().toISOString();
  const command = commandParts(config.opencodeCommand);
  const result = spawnExternalSync(command, args, {
    cwd: session.sessionDir,
    encoding: "utf8",
    timeout: timeoutSec * 1000,
    env: {
      ...process.env,
      PROTEUS_CHIMERA_SESSION_ID: session.publicId,
      PROTEUS_CHIMERA_SESSION_DIR: session.sessionDir,
      PROTEUS_CHIMERA_LAB_DIR: session.labDir,
      PROTEUS_CHIMERA_ACCESS_MODE: session.accessMode,
      PROTEUS_TARGET_ROOT: db.targetRoot
    }
  });
  const stdout = String(result.stdout ?? "");
  const stderr = String(result.stderr ?? "");
  fs.writeFileSync(stdoutPath, stdout);
  fs.writeFileSync(stderrPath, stderr);
  const run = {
    startedAt,
    completedAt: new Date().toISOString(),
    command: command.file,
    args: [...command.args, ...args],
    exitCode: result.status,
    signal: result.signal,
    timedOut: result.error?.name === "ETIMEDOUT",
    error: result.error ? String(result.error.message) : null
  };
  fs.writeFileSync(runPath, JSON.stringify(run, null, 2) + "\n");
  appendJsonl(path.join(session.sessionDir, "transcript.jsonl"), { type: "opencode_run", ...run });
  if (stdout.trim()) {
    const agentText = extractOpenCodeAssistantText(stdout.trim());
    db.addChimeraMessage({
      publicId: session.publicId,
      direction: "agent_to_coordinator",
      kind: "message",
      body: agentText,
      metadata: { source: "opencode_stdout", stdoutPath: toRelative(db.targetRoot, stdoutPath) },
      readByAgent: true
    });
  }
  if (stderr.trim()) {
    db.addChimeraMessage({
      publicId: session.publicId,
      direction: "system",
      kind: "error",
      body: truncate(stderr.trim(), 4000),
      metadata: { source: "opencode_stderr", stderrPath: toRelative(db.targetRoot, stderrPath) },
      readByAgent: true
    });
  }
  return {
    exitCode: result.status,
    timedOut: run.timedOut,
    stdoutPath,
    stderrPath,
    runPath,
    stdoutPreview: truncate(stdout.trim(), 1000),
    stderrPreview: truncate(stderr.trim(), 1000)
  };
}

function renderDossier(db: ProteusDb, session: ChimeraSessionRow, targetName: string): string {
  const campaign = session.campaignId ? db.getCampaign(session.campaignId) : null;
  const round = session.roundId ? db.getRound(session.roundId) : null;
  const activeCampaigns = db.listCampaigns("active").slice(0, 3);
  return `# Chimera Dossier ${session.publicId}

Target: ${targetName}
Role: ${session.role}
Goal: ${session.goal}
Campaign: ${campaign ? `C${campaign.id} ${campaign.title}` : "none"}
Round: ${round ? `R${round.id} ${round.objective}` : "none"}
Session dir: ${toRelative(db.targetRoot, session.sessionDir)}
Lab dir: ${toRelative(db.targetRoot, session.labDir)}

Coordinator context:
- Access mode: ${session.accessMode}.
- ${accessLine(session)}
- Use Proteus CLI for state and communication.
- Do not promote findings. Return hypotheses, blockers, evidence pointers, and validation needs.

Active campaigns:
${activeCampaigns.map((item) => `- C${item.id} [${item.status}] ${item.title}: ${item.currentStateSummary || item.objective}`).join("\n") || "- none"}

Stop conditions:
- You see kill.flag in the session directory.
- The branch becomes repetitive, speculative, or lacks testable signal.
- You need coordinator input to avoid unsafe or out-of-scope work.
`;
}

function renderContract(db: ProteusDb, session: ChimeraSessionRow, config: ChimeraConfig): string {
  const proteusCommand = proteusCliCommand();
  return `# Chimera Contract

You are a secondary Proteus agent. The coordinator remains the final authority.

Required behavior:
- Read dossier.md, contract.md, agent-instructions.md, and skills/*.md before acting.
- Respect access mode ${session.accessMode}: ${accessLine(session)}
- Use ${toRelative(db.targetRoot, session.labDir)} for notes, scripts, PoC material, and evidence even when broader access is granted.
- Prefer the workspace root as the Proteus base. Do not create stray .vros directories in subfolders.
- If you accidentally find or create a stray base, report it. The coordinator can merge it with proteus merge.
- Use concise snapshots and message the coordinator through Proteus.
- Poll your inbox before long work, after completing a branch, and before finalizing.
- Heartbeat before long work and after meaningful pivots.
- Do not invent evidence, ignore duplicate checks, or turn brainstorms into findings.
- Shared Chimera chat is advisory context. You do not need to answer every broadcast. Respond only when it changes your branch, asks you a direct question, or can help another active agent.
- Coordinator questions should be answered unless doing so would exceed scope or interrupt a higher-priority safety stop.
- Network is ${config.defaultNetwork ? "allowed only within the target authorization" : "disabled by default unless the coordinator explicitly authorizes it"}.

Communication commands:
- ${proteusCommand} --root "${db.targetRoot}" chimera poll --id ${session.publicId} --unread --agent
- ${proteusCommand} --root "${db.targetRoot}" chimera post --id ${session.publicId} --kind message --body "..."
- ${proteusCommand} --root "${db.targetRoot}" chimera broadcast --from-id ${session.publicId} --message "..."
- ${proteusCommand} --root "${db.targetRoot}" chimera snapshot --id ${session.publicId} --body "..."
- ${proteusCommand} --root "${db.targetRoot}" chimera heartbeat --id ${session.publicId}
`;
}

function renderAgentInstructions(db: ProteusDb, session: ChimeraSessionRow): string {
  const proteusCommand = proteusCliCommand();
  return `# Agent Instructions

Start with the highest-ROI path for this exact goal. Avoid broad repo review unless it directly supports the assignment.

For creative offensive work, generate several distinct branches, kill weak ones quickly, and preserve why they died. For fuzzing, learn how inputs change behavior instead of spraying generic payloads. For PoC work, prefer realistic manual blackbox reproduction and clear negative controls.

Before stopping, write a snapshot:

${proteusCommand} --root "${db.targetRoot}" chimera snapshot --id ${session.publicId} --body "Confirmed / killed / open / next move"
`;
}

function renderLabReadme(session: ChimeraSessionRow): string {
  return `# ${session.publicId} Lab

This is the private Chimera lab for role ${session.role}.

Preferred writes:
- notes.md
- poc/
- scripts/
- evidence/

Access mode: ${session.accessMode}
${accessLine(session)}
`;
}

function accessLine(session: ChimeraSessionRow): string {
  if (session.accessMode === "inherit") {
    return `The coordinator granted inherited workspace permissions for this task. ${session.accessNotes || "Use the broader access only where it directly supports the goal."}`;
  }
  return `Keep repository writes out of scope and write only inside the Chimera lab unless the coordinator redirects you. ${session.accessNotes}`;
}

function copySkillFiles(session: ChimeraSessionRow): void {
  const skillsDir = resolveSkillsDir();
  if (!skillsDir) return;
  const wanted = new Set(["continuous-vuln-research", "chimera-agent", session.role]);
  for (const name of wanted) {
    const source = path.join(skillsDir, name, "SKILL.md");
    if (!fs.existsSync(source)) continue;
    fs.copyFileSync(source, path.join(session.sessionDir, "skills", `${name}.md`));
    const opencodeSkillDir = path.join(session.sessionDir, ".opencode", "skills", name);
    ensureDir(opencodeSkillDir);
    fs.copyFileSync(source, path.join(opencodeSkillDir, "SKILL.md"));
  }
}

function writeOpenCodeAgentFile(session: ChimeraSessionRow, config: ChimeraConfig): void {
  const agentName = config.defaultAgent ?? "proteus-chimera";
  const permissions = session.accessMode === "inherit"
    ? ["bash", "read", "edit", "glob", "grep", "webfetch", "websearch", "skill", "lsp"]
    : ["bash", "read", "glob", "grep", "webfetch", "websearch", "skill", "lsp"];
  const agent = `---
description: Proteus Chimera secondary agent for ${session.role} work.
mode: primary
${session.model ? `model: ${session.model}\n` : ""}permissions:
  ${permissions.map((permission) => `${permission}: allow`).join("\n  ")}
---

# Proteus Chimera Runtime Agent

Read the attached dossier and the local Proteus skills before acting. Your session id is ${session.publicId}.

Operate through Proteus for coordination and memory. Use your Chimera lab for artifacts. Respect access mode ${session.accessMode}.

Do not wait for interactive permission approval. If an action is outside your granted access or unclear, post a blocker through Proteus instead of asking OpenCode to prompt a human.
`;
  fs.writeFileSync(path.join(session.sessionDir, ".opencode", "agents", `${agentName}.md`), agent);
}

function linkChimeraSession(db: ProteusDb, session: ChimeraSessionRow): Array<{ entityType: string; entityId: number }> {
  const linked: Array<{ entityType: string; entityId: number }> = [];
  if (session.campaignId) {
    const id = db.addEntityLink({
      fromType: "campaign",
      fromId: session.campaignId,
      toType: "chimera_session",
      toId: session.id,
      relation: "has_chimera_session",
      note: `Chimera ${session.publicId} ${session.role}: ${session.goal}`
    });
    linked.push({ entityType: "entity_link", entityId: id });
    db.addCampaignEvent({
      campaignId: session.campaignId,
      eventType: "chimera_started",
      entityType: "chimera_session",
      entityId: session.id,
      summary: `Started ${session.publicId} (${session.role}): ${session.goal}`
    });
  } else {
    const auto = db.linkActiveCampaignTo({
      toType: "chimera_session",
      toId: session.id,
      relation: "has_chimera_session",
      eventType: "chimera_started",
      eventSummary: `Started ${session.publicId} (${session.role}): ${session.goal}`
    });
    if (auto) linked.push({ entityType: "entity_link", entityId: auto.linkId });
  }
  return linked;
}

function writeStatusFile(db: ProteusDb, session: ChimeraSessionRow, extra: unknown = {}): void {
  ensureDir(session.sessionDir);
  fs.writeFileSync(path.join(session.sessionDir, "status.json"), JSON.stringify({ session, extra }, null, 2) + "\n");
}

function requireChimeraSession(db: ProteusDb, publicId: string): ChimeraSessionRow {
  const session = db.getChimeraSession(publicId);
  if (!session) throw new Error(`Chimera session not found: ${publicId}`);
  return session;
}

function nextPublicId(db: ProteusDb): string {
  const latest = db.listChimeraSessions({ limit: 1 })[0];
  return `CH-${String((latest?.id ?? 0) + 1).padStart(4, "0")}`;
}

function inboxPath(db: ProteusDb, publicId: string): string {
  return path.join(requireChimeraSession(db, publicId).sessionDir, "inbox.jsonl");
}

function outboxPath(db: ProteusDb, publicId: string): string {
  return path.join(requireChimeraSession(db, publicId).sessionDir, "outbox.jsonl");
}

function appendJsonl(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, JSON.stringify(value) + "\n");
}

function commandCheck(name: string, command: string, args: string[]): { name: string; ok: boolean; detail: string } {
  if (!command.trim()) return { name, ok: false, detail: "empty command" };
  const parsed = commandParts(command);
  const result = spawnExternalSync(parsed, args, { encoding: "utf8", timeout: 10000 });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return {
    name,
    ok: result.status === 0,
    detail: output || result.error?.message || `exit ${result.status}`
  };
}

function commandParts(command: string): { file: string; args: string[] } {
  const parts = command.match(/"([^"]+)"|'([^']+)'|[^\s]+/g)?.map((part) => part.replace(/^["']|["']$/g, "")) ?? [];
  if (parts.length === 0) return { file: command, args: [] };
  return { file: resolveWindowsCommand(parts[0]), args: parts.slice(1) };
}

function spawnExternalSync(
  command: { file: string; args: string[] },
  args: string[],
  options: Parameters<typeof spawnSync>[2]
): ReturnType<typeof spawnSync> {
  return spawnSync(command.file, [...command.args, ...args], {
    ...options,
    shell: needsWindowsShell(command.file)
  });
}

function resolveWindowsCommand(file: string): string {
  if (process.platform !== "win32" || /[\\/]/.test(file) || path.extname(file)) return file;
  const result = spawnSync("where.exe", [file], { encoding: "utf8" });
  if (result.status !== 0) return file;
  const candidates = String(result.stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const exe = candidates.find((candidate) => path.extname(candidate).toLowerCase() === ".exe");
  if (exe) return exe;
  const cmd = candidates.find((candidate) => path.extname(candidate).toLowerCase() === ".cmd");
  const cmdTarget = cmd ? resolveNpmShimTarget(cmd) : null;
  if (cmdTarget) return cmdTarget;
  return cmd ?? candidates.find((candidate) => path.extname(candidate).toLowerCase() === ".bat") ?? candidates[0] ?? file;
}

function needsWindowsShell(file: string): boolean {
  if (process.platform !== "win32") return false;
  const ext = path.extname(file).toLowerCase();
  return ext === ".cmd" || ext === ".bat";
}

function resolveNpmShimTarget(cmdPath: string): string | null {
  try {
    const body = fs.readFileSync(cmdPath, "utf8");
    const match = body.match(/node_modules[\\/][^"\r\n]+?\.exe/i);
    if (!match) return null;
    const target = path.join(path.dirname(cmdPath), match[0]);
    return fs.existsSync(target) ? target : null;
  } catch {
    return null;
  }
}

function canWriteDir(dir: string): boolean {
  try {
    ensureDir(dir);
    const probe = path.join(dir, ".write-probe");
    fs.writeFileSync(probe, "ok");
    fs.rmSync(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

function resolveSkillsDir(): string | null {
  const candidates = [
    path.resolve(__dirname, "..", "plugins", "proteus", "skills"),
    path.resolve(__dirname, "..", "skills")
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function resolveProteusCliPath(): string {
  const candidates = [
    path.resolve(__dirname, "cli.js"),
    path.resolve(__dirname, "..", "dist", "cli.js")
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? (process.argv[1] ?? "");
}

function proteusCliCommand(): string {
  return `${quoteArg(process.execPath)} ${quoteArg(resolveProteusCliPath())}`;
}

function quoteArg(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function extractOpenCodeAssistantText(stdout: string): string {
  const texts: string[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const event = JSON.parse(line) as { type?: string; part?: { type?: string; text?: string } };
      if (event.type === "text" && event.part?.type === "text" && event.part.text?.trim()) {
        texts.push(event.part.text.trim());
      }
    } catch {
      continue;
    }
  }
  if (texts.length > 0) return truncate(texts.join("\n").trim(), 4000);
  return "OpenCode run completed. See stdout log for the full transcript.";
}

function normalizeOpenCodeVariant(variant: string | undefined, provider: string | undefined, fallback: string | null): string | null {
  return variant?.trim() || provider?.trim() || fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function nullableString(value: unknown, fallback: string | null): string | null {
  if (value === null) return null;
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function positiveInteger(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 3)}...`;
}
