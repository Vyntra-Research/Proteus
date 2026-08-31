import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const expectedVersion = String(packageJson.version);
const compliantContractSignature = {
  status: "compliant",
  signedBy: "mcp-smoke",
  attackerModel: "External low-privilege attacker using documented product behavior.",
  heuristicCoverage: ["dedupe", "depth", "impact-elevation", "realism"],
  depthCoverage: { application: "checked", nativeOrLowLevel: "not-applicable", upstreamDependencies: "checked", fuzzing: "not-applicable", alternateRoutes: "checked" },
  impactElevation: { performed: true, strongestRealisticImpact: "MCP smoke-test integrity", chainsTested: [] },
  realismCheck: { scenario: "Default MCP smoke-test configuration", configuration: "default", forcedConditions: [] },
  antiSlopCheck: "Assertions and stored records were verified.",
  deviations: [],
  deviationRepair: null
};
const canonicalRoi = {
  impactPotential: 8,
  externalReachability: 7,
  trustBoundaryDensity: 6,
  recentChangeWeight: 5,
  unexploredInvariantWeight: 5,
  toolingReadiness: 5,
  duplicateRisk: 1,
  expectedBehaviorLikelihood: 0,
  priorExhaustionWeight: 0,
  validationCost: 1,
  lowSignalHistory: 0
};
const mockOpenCode = path.join(repoRoot, "scripts", "mock-opencode.mjs");
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "proteus-mcp-smoke-"));
const globalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "proteus-mcp-global-smoke-"));
const mergeSourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "proteus-mcp-merge-source-smoke-"));
const packagedPluginRoot = path.join(globalRoot, "packaged-plugin");
fs.cpSync(path.join(repoRoot, "plugins", "proteus"), packagedPluginRoot, { recursive: true });
const serverPath = path.join(packagedPluginRoot, "scripts", "proteus-mcp.cjs");
const mockOpenCodeLauncher = createMockOpenCodeLauncher(globalRoot);

const child = spawn(process.execPath, [serverPath], {
  cwd: repoRoot,
  env: {
    ...process.env,
    PROTEUS_GLOBAL_MEMORY_PATH: path.join(globalRoot, "global.sqlite"),
    PROTEUS_GLOBAL_EXPORTS_DIR: path.join(globalRoot, "exports"),
    PROTEUS_CHIMERA_CONFIG_PATH: path.join(globalRoot, "chimera", "config.json"),
    PROTEUS_ALLOW_MOCK_OPENCODE: "1",
    PROTEUS_CHIMERA_PORT_START: String(45000 + (process.pid % 1000))
  },
  stdio: ["pipe", "pipe", "pipe"]
});

let nextId = 1;
let stdout = "";
const pending = new Map();

function createMockOpenCodeLauncher(root) {
  if (process.platform !== "win32") return null;
  const launcher = path.join(root, "mock-opencode.cmd");
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(launcher, '@echo off\r\n"' + process.execPath + '" "' + mockOpenCode + '" %*\r\n');
  return launcher;
}

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  stdout += chunk;
  while (true) {
    const index = stdout.indexOf("\n");
    if (index === -1) break;
    const line = stdout.slice(0, index);
    stdout = stdout.slice(index + 1);
    const message = JSON.parse(line);
    const entry = pending.get(message.id);
    if (entry) {
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result);
    }
  }
});

child.stderr.on("data", (chunk) => process.stderr.write(chunk));

function request(method, params = {}) {
  const id = nextId++;
  const message = { jsonrpc: "2.0", id, method, params };
  child.stdin.write(JSON.stringify(message) + "\n");
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`timeout waiting for ${method}`));
      }
    }, 5000);
  });
}

async function requestFail(method, params = {}) {
  try {
    await request(method, params);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error(`${method} unexpectedly succeeded`);
}

try {
  const initialization = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "proteus-smoke-client", version: "0.1.0" }
  });
  if (initialization?.serverInfo?.version !== expectedVersion) {
    throw new Error(`packaged plugin MCP reported version ${initialization?.serverInfo?.version ?? "missing"}; expected ${expectedVersion}`);
  }
  const tools = await request("tools/list");
  const toolNames = tools.tools.map((tool) => tool.name);
  const campaignResumeTool = tools.tools.find((tool) => tool.name === "proteus_campaign_resume");
  if (campaignResumeTool?.outputSchema?.type !== "object") {
    throw new Error("proteus_campaign_resume does not advertise structured output");
  }
  const planRoundTool = tools.tools.find((tool) => tool.name === "proteus_plan_round");
  const recordSurfaceTool = tools.tools.find((tool) => tool.name === "proteus_record_surface");
  const updateHypothesisTool = tools.tools.find((tool) => tool.name === "proteus_update_hypothesis");
  if (planRoundTool?.inputSchema?.additionalProperties !== false ||
      planRoundTool?.inputSchema?.properties?.coordinatorPlan?.additionalProperties !== false ||
      planRoundTool?.inputSchema?.properties?.selectedSurfaces?.items?.additionalProperties !== false) {
    throw new Error("proteus_plan_round does not advertise strict coordinator metadata schemas");
  }
  if (recordSurfaceTool?.inputSchema?.additionalProperties !== false ||
      recordSurfaceTool?.inputSchema?.properties?.roi?.additionalProperties !== false ||
      !recordSurfaceTool.inputSchema.properties.roi.properties?.impactPotential) {
    throw new Error("proteus_record_surface does not advertise the concrete ROI schema");
  }
  if (updateHypothesisTool?.inputSchema?.additionalProperties !== false ||
      !updateHypothesisTool?.inputSchema?.properties?.status?.enum?.includes("discarded") ||
      updateHypothesisTool.inputSchema.properties.status.enum.includes("killed")) {
    throw new Error("proteus_update_hypothesis does not advertise the canonical strict status schema");
  }
  for (const expectedTool of [
    "proteus_init",
    "proteus_status",
    "proteus_migrate",
    "proteus_merge_memory",
    "proteus_chimera_config",
    "proteus_chimera_doctor",
    "proteus_chimera_stop_server",
    "proteus_chimera_start",
    "proteus_chimera_swarm",
    "proteus_chimera_council",
    "proteus_chimera_broadcast",
    "proteus_chimera_send",
    "proteus_chimera_post",
    "proteus_chimera_snapshot",
    "proteus_chimera_latest_snapshot",
    "proteus_chimera_workflow_snapshot",
    "proteus_chimera_heartbeat",
    "proteus_chimera_run",
    "proteus_chimera_attach_opencode",
    "proteus_chimera_poll",
    "proteus_chimera_list",
    "proteus_chimera_recover",
    "proteus_chimera_kill",
    "proteus_chimera_close",
    "proteus_ingest",
    "proteus_observe",
    "proteus_plan_round",
    "proteus_campaign_create",
    "proteus_campaign_resume",
    "proteus_campaign_checkpoint",
    "proteus_campaign_close",
    "proteus_record_branch",
    "proteus_update_branch",
    "proteus_update_hypothesis",
    "proteus_link_entities",
    "proteus_roles",
    "proteus_prompt",
    "proteus_query_duplicates",
    "proteus_query_memory",
    "proteus_query_similar",
    "proteus_get_record",
    "proteus_list_records",
    "proteus_record_surface",
    "proteus_record_hypothesis",
    "proteus_record_evidence",
    "proteus_record_decision",
    "proteus_record_gate",
    "proteus_record_agent_output",
    "proteus_update_surface",
    "proteus_update_round",
    "proteus_update_rounds",
    "proteus_query_revisit",
    "proteus_query_surfaces",
    "proteus_export",
    "proteus_lab_create",
    "proteus_record_global_learning",
    "proteus_query_global_learnings",
    "proteus_export_global_learnings"
  ]) {
    if (!toolNames.includes(expectedTool)) {
      throw new Error(`${expectedTool} tool was not registered`);
    }
  }

  await request("tools/call", {
    name: "proteus_init",
    arguments: { root: tmpRoot, name: "mcp-smoke-target" }
  });
  const migrations = await request("tools/call", {
    name: "proteus_migrate",
    arguments: { root: tmpRoot }
  });
  const migrationsText = String(migrations.content?.[0]?.text ?? "");
  if (!migrationsText.includes("2026-06-17-campaigns-links-branches")) {
    throw new Error("proteus_migrate did not report campaigns/links/branches migration");
  }
  if (!migrationsText.includes(`"currentVersion": "${expectedVersion}"`) || !migrationsText.includes(`"storedVersion": "${expectedVersion}"`)) {
    throw new Error("proteus_migrate did not report the Proteus database version");
  }
  fs.mkdirSync(path.join(tmpRoot, "REPORTS"), { recursive: true });
  fs.writeFileSync(
    path.join(tmpRoot, "REPORTS", "smoke-report.md"),
    "# Smoke Report\n\nSmoke daemon protocol surface duplicate report text.\n"
  );
  await request("tools/call", {
    name: "proteus_ingest",
    arguments: { root: tmpRoot, paths: ["REPORTS"] }
  });

  await request("tools/call", {
    name: "proteus_init",
    arguments: { root: mergeSourceRoot, name: "mcp-stray-merge-target" }
  });
  await request("tools/call", {
    name: "proteus_record_evidence",
    arguments: {
      root: mergeSourceRoot,
      title: "MCP stray merge evidence",
      kind: "note",
      body: "MCP stray merge evidence body"
    }
  });
  const mergeDryRun = await request("tools/call", {
    name: "proteus_merge_memory",
    arguments: { root: tmpRoot, sources: [path.join(mergeSourceRoot, ".vros", "memory.sqlite")], dryRun: true }
  });
  const mergeDryRunText = String(mergeDryRun.content?.[0]?.text ?? "");
  if (!mergeDryRunText.includes('"dryRun": true') || !mergeDryRunText.includes('"evidence": 1')) {
    throw new Error("proteus_merge_memory dry-run did not preview source evidence");
  }
  const mergeResult = await request("tools/call", {
    name: "proteus_merge_memory",
    arguments: { root: tmpRoot, sources: [path.join(mergeSourceRoot, ".vros")] }
  });
  const mergeResultText = String(mergeResult.content?.[0]?.text ?? "");
  if (!mergeResultText.includes('"dryRun": false') || !mergeResultText.includes('"evidence": 1')) {
    throw new Error("proteus_merge_memory did not merge source evidence");
  }
  const mergedMemory = await request("tools/call", {
    name: "proteus_query_memory",
    arguments: { root: tmpRoot, text: "MCP stray merge evidence body" }
  });
  if (!String(mergedMemory.content?.[0]?.text ?? "").includes('"entityType": "evidence"')) {
    throw new Error("merged MCP evidence was not searchable in destination memory");
  }

  const status = await request("tools/call", {
    name: "proteus_status",
    arguments: { root: tmpRoot }
  });
  const text = status.content?.[0]?.text ?? "";
  if (!text.includes("mcp-smoke-target")) {
    throw new Error("proteus_status did not return initialized target");
  }
  if (!text.includes('"memory"')) {
    throw new Error("proteus_status did not return memory stats");
  }
  if (!text.includes('"proteusVersion"') || !text.includes(`"storedVersion": "${expectedVersion}"`)) {
    throw new Error("proteus_status did not return Proteus database version state");
  }

  const opencodeCommand = mockOpenCodeLauncher
    ? '"' + mockOpenCodeLauncher + '"'
    : '"' + process.execPath + '" "' + mockOpenCode + '"';
  const chimeraConfig = await request("tools/call", {
    name: "proteus_chimera_config",
    arguments: { action: "init", opencodeCommand, model: "mock/mock-model", variant: "high", maxAgents: 3 }
  });
  const chimeraConfigText = String(chimeraConfig.content?.[0]?.text ?? "");
  if (!chimeraConfigText.includes('"enabled": true') || !chimeraConfigText.includes("mock/mock-model") || !chimeraConfigText.includes('"defaultVariant": "high"')) {
    throw new Error("proteus_chimera_config did not enable mock Chimera config");
  }
  if (!chimeraConfigText.includes('"defaultTimeoutSec": 0')) {
    throw new Error("proteus_chimera_config should default to no run timeout");
  }
  const chimeraTimeoutConfig = await request("tools/call", {
    name: "proteus_chimera_config",
    arguments: { action: "init", timeout: 5 }
  });
  if (!String(chimeraTimeoutConfig.content?.[0]?.text ?? "").includes('"defaultTimeoutSec": 5')) {
    throw new Error("proteus_chimera_config did not persist explicit timeout");
  }
  const chimeraNoTimeoutConfig = await request("tools/call", {
    name: "proteus_chimera_config",
    arguments: { action: "init", timeout: 0 }
  });
  if (!String(chimeraNoTimeoutConfig.content?.[0]?.text ?? "").includes('"defaultTimeoutSec": 0')) {
    throw new Error("proteus_chimera_config timeout 0 did not disable default timeout");
  }
  const chimeraConfigPartial = await request("tools/call", {
    name: "proteus_chimera_config",
    arguments: { action: "init", model: "mock/other-model" }
  });
  const chimeraConfigPartialJson = JSON.parse(String(chimeraConfigPartial.content?.[0]?.text ?? "{}"));
  if (
    chimeraConfigPartialJson.record?.opencodeCommand !== opencodeCommand ||
    chimeraConfigPartialJson.record?.defaultVariant !== "high" ||
    chimeraConfigPartialJson.record?.defaultModel !== "mock/other-model"
  ) {
    throw new Error("proteus_chimera_config partial init did not preserve existing global config fields");
  }
  if (!fs.existsSync(path.join(globalRoot, "chimera", "config.json"))) {
    throw new Error("proteus_chimera_config did not write global config");
  }
  if (fs.existsSync(path.join(tmpRoot, ".vros", "chimera", "config.json"))) {
    throw new Error("proteus_chimera_config should not write workspace config");
  }
  const chimeraDoctor = await request("tools/call", {
    name: "proteus_chimera_doctor",
    arguments: { root: tmpRoot }
  });
  if (!String(chimeraDoctor.content?.[0]?.text ?? "").includes('"ok": true')) {
    throw new Error("proteus_chimera_doctor did not pass with mock OpenCode");
  }
  const chimeraStart = await request("tools/call", {
    name: "proteus_chimera_start",
    arguments: {
      root: tmpRoot,
      role: "chaining",
      goal: "MCP Chimera chain",
      access: "editor",
      accessNotes: "MCP smoke editor grant: non-destructive shell only; edit generated lab files only."
    }
  });
  const chimeraStartText = String(chimeraStart.content?.[0]?.text ?? "");
  if (!chimeraStartText.includes('"publicId": "CH-0001"') || !chimeraStartText.includes('"accessMode": "editor"') || !chimeraStartText.includes('"backgroundRun"') || !chimeraStartText.includes('"status": "starting"')) {
    throw new Error("proteus_chimera_start did not create editor CH-0001");
  }
  const chimeraRecover = await request("tools/call", {
    name: "proteus_chimera_recover",
    arguments: { root: tmpRoot, id: "CH-0001" }
  });
  const chimeraRecoverText = String(chimeraRecover.content?.[0]?.text ?? "");
  if (!chimeraRecoverText.includes('"publicId": "CH-0001"') || !chimeraRecoverText.includes('"controlStatus"')) {
    throw new Error("proteus_chimera_recover did not return reconciled session and control status");
  }
  const invalidAttach = await requestFail("tools/call", {
    name: "proteus_chimera_attach_opencode",
    arguments: { root: tmpRoot, id: "CH-0001", serverUrl: "http://127.0.0.1:4096" }
  });
  if (!invalidAttach.includes("Expected non-empty string")) {
    throw new Error("proteus_chimera_attach_opencode should require an OpenCode session id");
  }
  await waitForFile(path.join(tmpRoot, ".vros", "chimera", "sessions", "CH-0001", "opencode", "run.json"), 10000);
  const chimeraRunRecover = await request("tools/call", {
    name: "proteus_chimera_recover",
    arguments: { root: tmpRoot, id: "CH-0001" }
  });
  const chimeraRunJson = JSON.parse(String(chimeraRunRecover.content?.[0]?.text ?? "{}"));
  if (chimeraRunJson.record?.session?.opencodeSessionId !== "ses_mock_CH-0001") {
    throw new Error("proteus_chimera_start auto-run did not attach the mock OpenCode session");
  }
  const chimeraServerUrl = chimeraRunJson.record?.session?.opencodeServerUrl;
  if (typeof chimeraServerUrl !== "string" || !chimeraServerUrl.startsWith("http://127.0.0.1:")) {
    throw new Error("proteus_chimera_start auto-run did not persist a mock OpenCode server URL");
  }
  const mockRegistryPath = path.join(tmpRoot, ".vros", "chimera", "mock-opencode-sessions.json");
  fs.mkdirSync(path.dirname(mockRegistryPath), { recursive: true });
  fs.writeFileSync(mockRegistryPath, JSON.stringify([
    {
      id: "ses_mock_wrong_workspace_CH_0001",
      title: "proteus-CH-0001",
      directory: path.join(tmpRoot, "wrong-workspace", ".vros", "chimera", "sessions", "CH-0001"),
      time: { created: 1, updated: 9999999999999 }
    },
    {
      id: "ses_mock_CH-0001",
      title: "proteus-CH-0001",
      directory: path.join(tmpRoot, ".vros", "chimera", "sessions", "CH-0001"),
      time: { created: 1, updated: 2 }
    }
  ], null, 2) + "\n");
  await request("tools/call", {
    name: "proteus_chimera_attach_opencode",
    arguments: { root: tmpRoot, id: "CH-0001", serverUrl: chimeraServerUrl, opencodeSessionId: "ses_mock_wrong_workspace_CH_0001" }
  });
  const staleSnapshot = await request("tools/call", {
    name: "proteus_chimera_workflow_snapshot",
    arguments: { root: tmpRoot, id: "CH-0001", limit: 1, maxMessageChars: 80 }
  });
  const staleSnapshotText = String(staleSnapshot.content?.[0]?.text ?? "");
  if (!staleSnapshotText.includes('"opencodeSessionId": "ses_mock_CH-0001"') || staleSnapshotText.includes("ses_mock_wrong_workspace_CH_0001")) {
    throw new Error("proteus_chimera_workflow_snapshot did not reconcile a stale OpenCode session id");
  }
  const chimeraRunAfterWrongAttach = await request("tools/call", {
    name: "proteus_chimera_run",
    arguments: { root: tmpRoot, id: "CH-0001", timeout: 10, message: "MCP resume instruction" }
  });
  const chimeraRunAfterWrongAttachJson = JSON.parse(String(chimeraRunAfterWrongAttach.content?.[0]?.text ?? "{}"));
  if (chimeraRunAfterWrongAttachJson.record?.run?.exitCode !== 0 || chimeraRunAfterWrongAttachJson.record?.session?.opencodeSessionId !== "ses_mock_CH-0001") {
    throw new Error("proteus_chimera_run did not recover from a stale OpenCode session id");
  }
  const chimeraRunAfterWrongAttachRecord = JSON.parse(fs.readFileSync(path.join(tmpRoot, ".vros", "chimera", "sessions", "CH-0001", "opencode", "run.json"), "utf8"));
  if (chimeraRunAfterWrongAttachRecord.args.includes("ses_mock_wrong_workspace_CH_0001")) {
    throw new Error("proteus_chimera_run reused a stale OpenCode session id from another workspace");
  }
  if (!chimeraRunAfterWrongAttachRecord.args.some((arg) => String(arg).includes("MCP resume instruction"))) {
    throw new Error("proteus_chimera_run did not pass the MCP resume instruction to OpenCode");
  }
  const chimeraWorkflowSnapshot = await request("tools/call", {
    name: "proteus_chimera_workflow_snapshot",
    arguments: { root: tmpRoot, id: "CH-0001", limit: 3, maxMessageChars: 80 }
  });
  const workflowSnapshotText = String(chimeraWorkflowSnapshot.content?.[0]?.text ?? "");
  if (!workflowSnapshotText.includes("First compact agent workflow message") || workflowSnapshotText.includes("TOOL RESULT THAT MUST NOT APPEAR")) {
    throw new Error("proteus_chimera_workflow_snapshot did not return filtered compact agent messages");
  }
  const removedExportKeys = ["requested" + "San" + "itize", "fallbackFrom" + "San" + "itizedExport"];
  if (removedExportKeys.some((key) => workflowSnapshotText.includes(key))) {
    throw new Error("proteus_chimera_workflow_snapshot should not expose removed export compatibility fields");
  }
  await request("tools/call", {
    name: "proteus_chimera_post",
    arguments: { root: tmpRoot, id: "CH-0001", kind: "finding", body: "MCP Chimera finding" }
  });
  const chimeraPoll = await request("tools/call", {
    name: "proteus_chimera_poll",
    arguments: { root: tmpRoot, id: "CH-0001", unreadOnly: true }
  });
  if (!String(chimeraPoll.content?.[0]?.text ?? "").includes("MCP Chimera finding")) {
    throw new Error("proteus_chimera_poll did not return unread agent message");
  }
  await request("tools/call", {
    name: "proteus_chimera_send",
    arguments: { root: tmpRoot, id: "CH-0001", kind: "redirect", message: "MCP coordinator redirect", priority: true }
  });
  const chimeraAgentPoll = await request("tools/call", {
    name: "proteus_chimera_poll",
    arguments: { root: tmpRoot, id: "CH-0001", unreadOnly: true, forAgent: true }
  });
  if (!String(chimeraAgentPoll.content?.[0]?.text ?? "").includes("MCP coordinator redirect")) {
    throw new Error("proteus_chimera_poll did not return coordinator-to-agent message");
  }
  if (!String(chimeraAgentPoll.content?.[0]?.text ?? "").includes('"priority": true')) {
    throw new Error("proteus_chimera_send did not preserve priority metadata");
  }
  const chimeraBroadcast = await request("tools/call", {
    name: "proteus_chimera_broadcast",
    arguments: { root: tmpRoot, message: "MCP shared chat", priority: true }
  });
  const chimeraBroadcastJson = JSON.parse(String(chimeraBroadcast.content?.[0]?.text ?? "{}"));
  if (chimeraBroadcastJson.record?.delivered?.length !== 0 || !chimeraBroadcastJson.record?.skipped?.some((entry) => entry.publicId === "CH-0001" && entry.reason === "status stopped")) {
    throw new Error("proteus_chimera_broadcast should skip stopped sessions");
  }
  await request("tools/call", {
    name: "proteus_chimera_snapshot",
    arguments: { root: tmpRoot, id: "CH-0001", body: `MCP Chimera snapshot\n${"MCP large snapshot body ".repeat(500)}` }
  });
  const largeMcpSnapshotPoll = await request("tools/call", {
    name: "proteus_chimera_poll",
    arguments: { root: tmpRoot, id: "CH-0001", peek: true }
  });
  const largeMcpSnapshotJson = JSON.parse(String(largeMcpSnapshotPoll.content?.[0]?.text ?? "{}"));
  const largeMcpSnapshotMessage = largeMcpSnapshotJson.record?.messages?.find((message) => message.kind === "snapshot");
  if (!largeMcpSnapshotMessage?.bodyTruncated || !largeMcpSnapshotMessage.fullBodyPath || !fs.existsSync(largeMcpSnapshotMessage.fullBodyPath)) {
    throw new Error("proteus_chimera_poll did not expose large snapshot preview and full body path");
  }
  const largeMcpLatestSnapshot = await request("tools/call", {
    name: "proteus_chimera_latest_snapshot",
    arguments: { root: tmpRoot, id: "CH-0001", limit: 1 }
  });
  const largeMcpLatestSnapshotJson = JSON.parse(String(largeMcpLatestSnapshot.content?.[0]?.text ?? "{}"));
  if (
    largeMcpLatestSnapshotJson.record?.mode !== "read" ||
    !largeMcpLatestSnapshotJson.record?.latestSnapshots?.some((snapshot) => snapshot.publicId === "CH-0001" && snapshot.fullBodyPath)
  ) {
    throw new Error("proteus_chimera_latest_snapshot did not read latest agent-authored snapshot state");
  }
  const chimeraHeartbeat = await request("tools/call", {
    name: "proteus_chimera_heartbeat",
    arguments: { root: tmpRoot, id: "CH-0001" }
  });
  const chimeraHeartbeatJson = JSON.parse(String(chimeraHeartbeat.content?.[0]?.text ?? "{}"));
  if (chimeraHeartbeatJson.record?.killed !== false || chimeraHeartbeatJson.record?.session?.publicId !== "CH-0001" || chimeraHeartbeatJson.record?.session?.status !== "stopped") {
    throw new Error("proteus_chimera_heartbeat did not report stopped reusable session state");
  }
  const chimeraSwarm = await request("tools/call", {
    name: "proteus_chimera_swarm",
    arguments: {
      root: tmpRoot,
      plan: {
        agents: [
          { role: "codebase-research", goal: "MCP map surface" },
          { role: "fuzzing", goal: "MCP fuzz surface" }
        ]
      }
    }
  });
  const chimeraSwarmText = String(chimeraSwarm.content?.[0]?.text ?? "");
  if (!chimeraSwarmText.includes('"publicId": "CH-0002"') || !chimeraSwarmText.includes('"publicId": "CH-0003"')) {
    throw new Error("proteus_chimera_swarm did not create independent sessions");
  }
  const chimeraBackgroundStart = await request("tools/call", {
    name: "proteus_chimera_start",
    arguments: {
      root: tmpRoot,
      role: "explorer",
      goal: "MCP background Chimera launch",
      run: true
    }
  });
  const chimeraBackgroundStartText = String(chimeraBackgroundStart.content?.[0]?.text ?? "");
  if (!chimeraBackgroundStartText.includes('"publicId": "CH-0004"') || !chimeraBackgroundStartText.includes('"backgroundRun"') || !chimeraBackgroundStartText.includes('"started": true') || !chimeraBackgroundStartText.includes('"status": "starting"')) {
    throw new Error("proteus_chimera_start run=true without timeout should return a background run");
  }
  await waitForFile(path.join(tmpRoot, ".vros", "chimera", "sessions", "CH-0004", "opencode", "run.json"), 10000);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await request("tools/call", {
    name: "proteus_chimera_send",
    arguments: { root: tmpRoot, fromId: "CH-0001", toId: "CH-0002", message: "MCP direct Chimera message" }
  });
  const chimeraDirectPoll = await request("tools/call", {
    name: "proteus_chimera_poll",
    arguments: { root: tmpRoot, id: "CH-0002", unreadOnly: true, forAgent: true }
  });
  const chimeraDirectPollText = String(chimeraDirectPoll.content?.[0]?.text ?? "");
  if (!chimeraDirectPollText.includes("MCP direct Chimera message") || !chimeraDirectPollText.includes('"fromId": "CH-0001"')) {
    throw new Error("proteus_chimera_send did not deliver direct agent-to-agent message metadata");
  }
  const chimeraCouncil = await request("tools/call", {
    name: "proteus_chimera_council",
    arguments: {
      root: tmpRoot,
      action: "start",
      topic: "MCP stalled branch brainstorm",
      reason: "MCP checkpoint needs fresh angles",
      ids: ["CH-0001", "CH-0002"],
      maxRounds: 1
    }
  });
  const councilText = String(chimeraCouncil.content?.[0]?.text ?? "");
  const councilId = councilText.match(/"councilId": "([^"]+)"/)?.[1];
  if (!councilId || !councilText.includes('"participants"')) {
    throw new Error("proteus_chimera_council start did not return a council id and participants");
  }
  await request("tools/call", {
    name: "proteus_chimera_council",
    arguments: { root: tmpRoot, action: "accept", id: "CH-0001", councilId, body: "MCP CH-0001 ready" }
  });
  const councilOpenRound = await request("tools/call", {
    name: "proteus_chimera_council",
    arguments: { root: tmpRoot, action: "open-round", councilId, round: 1, message: "MCP round 1 opening" }
  });
  const councilOpenRoundText = String(councilOpenRound.content?.[0]?.text ?? "");
  if (!councilOpenRoundText.includes('"firstCue"') || !councilOpenRoundText.includes("it is your ordered turn now") || !councilOpenRoundText.includes("MCP CH-0001 ready")) {
    throw new Error("proteus_chimera_council open-round did not automatically cue first accepted participant with transcript");
  }
  await request("tools/call", {
    name: "proteus_chimera_council",
    arguments: { root: tmpRoot, action: "turn", id: "CH-0001", councilId, round: 1, body: "MCP CH-0001 observation" }
  });
  const councilStatus = await request("tools/call", {
    name: "proteus_chimera_council",
    arguments: { root: tmpRoot, action: "status", councilId }
  });
  const councilStatusText = String(councilStatus.content?.[0]?.text ?? "");
  if (!councilStatusText.includes('"readyCount": 1') || !councilStatusText.includes("MCP CH-0001 observation")) {
    throw new Error("proteus_chimera_council status did not recover accept and turn messages");
  }
  const councilClose = await request("tools/call", {
    name: "proteus_chimera_council",
    arguments: { root: tmpRoot, action: "close", councilId, summary: "MCP council final decision", instruction: "Resume MCP smoke work" }
  });
  if (!String(councilClose.content?.[0]?.text ?? "").includes('"closed": true')) {
    throw new Error("proteus_chimera_council close did not mark the council closed");
  }
  await request("tools/call", {
    name: "proteus_chimera_kill",
    arguments: { root: tmpRoot, id: "CH-0001", reason: "MCP smoke kill" }
  });
  const chimeraClose = await request("tools/call", {
    name: "proteus_chimera_close",
    arguments: { root: tmpRoot, id: "CH-0001", verdict: "watchlist", summary: "MCP smoke close" }
  });
  if (!String(chimeraClose.content?.[0]?.text ?? "").includes('"closeVerdict": "watchlist"')) {
    throw new Error("proteus_chimera_close did not persist verdict");
  }
  const activeChimeraList = await request("tools/call", {
    name: "proteus_chimera_list",
    arguments: { root: tmpRoot, active: true }
  });
  const activeChimeraListText = String(activeChimeraList.content?.[0]?.text ?? "");
  const activeChimeraListJson = JSON.parse(activeChimeraListText);
  if (activeChimeraListJson.record?.sessions?.some((session) => session.publicId === "CH-0001" || session.status === "stopped")) {
    throw new Error("proteus_chimera_list active=true returned stopped sessions");
  }
  const reusableChimeraList = await request("tools/call", {
    name: "proteus_chimera_list",
    arguments: { root: tmpRoot }
  });
  const reusableChimeraListJson = JSON.parse(String(reusableChimeraList.content?.[0]?.text ?? "{}"));
  if (!reusableChimeraListJson.record?.sessions?.some((session) => session.publicId === "CH-0001" && session.status === "stopped" && session.closeVerdict === "watchlist") || !JSON.stringify(reusableChimeraListJson.record?.advisories).includes("Session is stopped")) {
    throw new Error("proteus_chimera_list did not expose reusable stopped sessions with resume guidance");
  }

  await request("tools/call", {
    name: "proteus_plan_round",
    arguments: { root: tmpRoot, objective: "MCP smoke plan", markdown: false }
  });
  await request("tools/call", {
    name: "proteus_campaign_create",
    arguments: { root: tmpRoot, title: "MCP smoke campaign", objective: "MCP smoke campaign objective" }
  });
  const campaignDigest = await request("tools/call", {
    name: "proteus_campaign_resume",
    arguments: { root: tmpRoot }
  });
  if (!String(campaignDigest.content?.[0]?.text ?? "").includes("MCP smoke campaign")) {
    throw new Error("proteus_campaign_resume did not return campaign digest");
  }
  await request("tools/call", {
    name: "proteus_record_branch",
    arguments: {
      root: tmpRoot,
      campaignId: 1,
      roundId: 1,
      title: "MCP smoke branch",
      attackPrimitive: "attacker-controlled transition",
      steps: ["step one"],
      killConditions: ["control fails"]
    }
  });
  for (let index = 0; index < 12; index += 1) {
    await request("tools/call", {
      name: "proteus_record_branch",
      arguments: {
        root: tmpRoot,
        campaignId: 1,
        roundId: 1,
        title: `MCP pagination branch ${index}`,
        attackPrimitive: `bounded primitive ${index}`,
        whyNonObvious: "x".repeat(1200),
        steps: ["y".repeat(2500)],
        killConditions: ["control fails"]
      }
    });
  }
  const checkpoint = await request("tools/call", {
    name: "proteus_campaign_checkpoint",
    arguments: {
      root: tmpRoot,
      id: 1,
      confirmed: ["surface mapped"],
      killed: Array.from({ length: 20 }, (_, index) => `killed path ${index}: ${"z".repeat(120)}`),
      open: ["q".repeat(600)],
      pivots: ["stay on daemon boundary"],
      contextToPersist: ["MCP checkpoint context"],
      nextHighRoiMove: "Validate MCP smoke branch",
      contractSignature: compliantContractSignature,
      summary: "MCP smoke checkpoint"
    }
  });
  const checkpointText = String(checkpoint.content?.[0]?.text ?? "");
  if (!checkpointText.includes('"checkpointId"') || !checkpointText.includes('"campaign_checkpoint"')) {
    throw new Error("proteus_campaign_checkpoint did not return the structured checkpoint envelope");
  }
  const rejectedCheckpoint = await requestFail("tools/call", {
    name: "proteus_campaign_checkpoint",
    arguments: { root: tmpRoot, id: 1, contractSignature: {} }
  });
  if (!rejectedCheckpoint.includes("Invalid checkpoint contractSignature") || !rejectedCheckpoint.includes("missing attackerModel")) {
    throw new Error("proteus_campaign_checkpoint accepted an incomplete contract signature");
  }
  const falseCompliance = await requestFail("tools/call", {
    name: "proteus_campaign_checkpoint",
    arguments: {
      root: tmpRoot,
      id: 1,
      contractSignature: {
        ...compliantContractSignature,
        impactElevation: { ...compliantContractSignature.impactElevation, performed: false }
      }
    }
  });
  if (!falseCompliance.includes("compliant status requires impactElevation.performed to be true")) {
    throw new Error("proteus_campaign_checkpoint accepted a false compliant attestation");
  }
  const boundedResume = await request("tools/call", {
    name: "proteus_campaign_resume",
    arguments: { root: tmpRoot, id: 1, limit: 1 }
  });
  const boundedRecord = boundedResume.structuredContent?.record;
  if (!boundedRecord?.latestCheckpoint || boundedRecord.latestCheckpoint.id !== 1 || boundedRecord.pagination?.checkpoints?.returned !== 1) {
    throw new Error("proteus_campaign_resume did not preserve the latest checkpoint in structured bounded output");
  }
  if (boundedRecord.latestCheckpoint.killed?.total !== 20 || boundedRecord.latestCheckpoint.killed?.truncated !== true) {
    throw new Error("proteus_campaign_resume did not disclose shortened latest-checkpoint state");
  }
  if (boundedRecord.latestCheckpoint.open?.total !== 1 || boundedRecord.latestCheckpoint.open?.truncated !== true) {
    throw new Error("proteus_campaign_resume did not disclose character-level checkpoint truncation");
  }
  if (boundedRecord.openBranches?.length !== 1 || boundedRecord.pagination?.openBranches?.hasMore !== true || boundedRecord.pagination?.openBranches?.nextCursor === null) {
    throw new Error("proteus_campaign_resume did not paginate open branch summaries");
  }
  if ("steps" in boundedRecord.openBranches[0] || JSON.stringify(boundedRecord).includes("y".repeat(100))) {
    throw new Error("proteus_campaign_resume included full branch payloads in the bounded digest");
  }
  const nextBranchPage = await request("tools/call", {
    name: "proteus_campaign_resume",
    arguments: { root: tmpRoot, id: 1, limit: 1, branchCursor: boundedRecord.pagination.openBranches.nextCursor }
  });
  const nextBranchRecord = nextBranchPage.structuredContent?.record;
  if (nextBranchRecord?.openBranches?.length !== 1 || nextBranchRecord.openBranches[0].id === boundedRecord.openBranches[0].id) {
    throw new Error("proteus_campaign_resume branch cursor did not advance");
  }
  const defaultResume = await request("tools/call", {
    name: "proteus_campaign_resume",
    arguments: { root: tmpRoot, id: 1 }
  });
  const defaultResumeText = String(defaultResume.content?.[0]?.text ?? "");
  if (defaultResumeText.length > 30000 || defaultResume.structuredContent?.record?.pagination?.openBranches?.hasMore !== true) {
    throw new Error(`proteus_campaign_resume default digest was not bounded: ${defaultResumeText.length} chars`);
  }
  const legacyDb = new DatabaseSync(path.join(tmpRoot, ".vros", "memory.sqlite"));
  legacyDb.prepare("UPDATE campaign_checkpoints SET contract_signature_json = '{}' WHERE id = 1").run();
  legacyDb.prepare("UPDATE campaigns SET objective = ?, current_state_summary = ?, recent_learning_summary = ? WHERE id = 1")
    .run("o".repeat(4000), "s".repeat(4000), "l".repeat(4000));
  legacyDb.close();
  const legacyResume = await request("tools/call", {
    name: "proteus_campaign_resume",
    arguments: { root: tmpRoot, id: 1 }
  });
  if (legacyResume.structuredContent?.record?.latestCheckpoint?.contractAttestation?.valid !== false ||
      !legacyResume.structuredContent?.advisories?.some((advisory) => advisory.code === "checkpoint_contract_noncompliant")) {
    throw new Error("proteus_campaign_resume did not flag a historical incomplete checkpoint");
  }
  if (legacyResume.structuredContent?.record?.campaign?.truncated !== true ||
      legacyResume.structuredContent.record.campaign.objective.length > 1000 ||
      legacyResume.structuredContent.record.campaign.currentStateSummary.length > 1500) {
    throw new Error("proteus_campaign_resume did not bound campaign summary fields");
  }
  const promotedWithInvalidCheckpoint = await requestFail("tools/call", {
    name: "proteus_update_branch",
    arguments: { root: tmpRoot, id: 1, status: "promoted" }
  });
  if (!promotedWithInvalidCheckpoint.includes("latest checkpoint K1 is not contract-compliant") ||
      !promotedWithInvalidCheckpoint.includes("missing attackerModel") ||
      !promotedWithInvalidCheckpoint.includes("depthCoverage must be an object")) {
    throw new Error("Proteus did not return field-level diagnostics for invalid-checkpoint promotion");
  }
  const closedWithInvalidCheckpoint = await requestFail("tools/call", {
    name: "proteus_campaign_close",
    arguments: { root: tmpRoot, id: 1, status: "completed" }
  });
  if (!closedWithInvalidCheckpoint.includes("latest checkpoint K1 is not contract-compliant") ||
      !closedWithInvalidCheckpoint.includes("missing attackerModel") ||
      !closedWithInvalidCheckpoint.includes("depthCoverage must be an object")) {
    throw new Error("Proteus did not return field-level diagnostics for invalid-checkpoint completion");
  }
  const checkpointRecord = await request("tools/call", {
    name: "proteus_get_record",
    arguments: { root: tmpRoot, entityType: "checkpoint", entityId: 1 }
  });
  if (!String(checkpointRecord.content?.[0]?.text ?? "").includes("MCP checkpoint context")) {
    throw new Error("proteus_get_record did not return the campaign checkpoint");
  }
  await request("tools/call", {
    name: "proteus_link_entities",
    arguments: { root: tmpRoot, fromType: "campaign", fromId: 1, relation: "has_round", toType: "round", toId: 1 }
  });
  const recordedSurface = await request("tools/call", {
    name: "proteus_record_surface",
    arguments: {
      root: tmpRoot,
      name: "Smoke daemon protocol surface",
      family: "daemon-protocol",
      description: "MCP target-specific surface",
      files: ["daemon.ts"],
      status: "active",
      revisitCondition: "mcp revisit",
      roi: canonicalRoi
    }
  });
  const recordedSurfaceJson = JSON.parse(String(recordedSurface.content?.[0]?.text ?? "{}"));
  const canonicalSurfaceId = recordedSurfaceJson.id;
  if (!canonicalSurfaceId || recordedSurfaceJson.surface?.roiScore !== 34) {
    throw new Error("proteus_record_surface did not return the normalized ROI 34 surface");
  }
  const rejectedSurfaceMetadata = await requestFail("tools/call", {
    name: "proteus_record_surface",
    arguments: {
      root: tmpRoot,
      name: "Invalid descriptive ROI surface",
      roi: { impactCeiling: "high", priority: "high" }
    }
  });
  if (!rejectedSurfaceMetadata.includes("unsupported field(s): impactCeiling, priority")) {
    throw new Error("proteus_record_surface silently discarded unsupported ROI metadata");
  }
  const suppliedPlan = await request("tools/call", {
    name: "proteus_plan_round",
    arguments: {
      root: tmpRoot,
      objective: "MCP coordinator supplied plan",
      coordinatorPlan: {
        currentUnderstanding: "Smoke coordinator context",
        selectedSurfaces: [
          {
            id: canonicalSurfaceId,
            reason: "Coordinator supplied a narrow surface",
            files: ["daemon.ts"]
          }
        ],
        agentFronts: [
          {
            codename: "argus",
            assignedSurfaceIds: [canonicalSurfaceId],
            purpose: "Inspect the supplied smoke surface"
          },
          {
            codename: "coordinator-main",
            assignedSurfaceIds: [canonicalSurfaceId],
            purpose: "Coordinator-owned execution front",
            requiredOutput: ["operator status", "next move"]
          }
        ]
      },
      markdown: false
    }
  });
  const suppliedText = String(suppliedPlan.content?.[0]?.text ?? "");
  if (!suppliedText.includes('"planningMode": "coordinator_supplied"')) {
    throw new Error("proteus_plan_round did not preserve coordinator-supplied planning mode");
  }
  if (!suppliedText.includes('"status": "active"')) {
    throw new Error("proteus_plan_round did not create an active plan by default");
  }
  if (!suppliedText.includes('"codename": "coordinator-main"') || !suppliedText.includes('"family": "daemon-protocol"')) {
    throw new Error("proteus_plan_round did not preserve the custom front and canonical surface family");
  }
  if (!suppliedText.includes('"roiScore": 34') || !suppliedText.includes('"reason": "Coordinator supplied a narrow surface"') || !suppliedText.includes('"daemon.ts"')) {
    throw new Error("proteus_plan_round did not hydrate canonical ROI while preserving documented round overrides");
  }
  const rejectedPlanMetadata = await requestFail("tools/call", {
    name: "proteus_plan_round",
    arguments: {
      root: tmpRoot,
      objective: "Reject unsupported coordinator metadata",
      selectedSurfaces: [{ id: canonicalSurfaceId, priority: "high", rationale: "unsupported alias" }]
    }
  });
  if (!rejectedPlanMetadata.includes("unsupported field(s): priority, rationale")) {
    throw new Error("proteus_plan_round silently discarded unsupported surface metadata");
  }
  const activePlans = await request("tools/call", {
    name: "proteus_list_records",
    arguments: { root: tmpRoot, recordType: "rounds", status: "active" }
  });
  if (!String(activePlans.content?.[0]?.text ?? "").includes("MCP coordinator supplied plan")) {
    throw new Error("proteus_list_records did not return active rounds");
  }
  const branchRecords = await request("tools/call", {
    name: "proteus_list_records",
    arguments: { root: tmpRoot, recordType: "branches", entityType: "campaign", entityId: 1 }
  });
  if (!String(branchRecords.content?.[0]?.text ?? "").includes("MCP smoke branch")) {
    throw new Error("proteus_list_records did not return recorded branches");
  }
  const updateBranch = await request("tools/call", {
    name: "proteus_update_branch",
    arguments: { root: tmpRoot, id: "B1", status: "testing" }
  });
  if (!String(updateBranch.content?.[0]?.text ?? "").includes('"status": "testing"')) {
    throw new Error("proteus_update_branch did not move branch to testing");
  }
  await request("tools/call", {
    name: "proteus_update_round",
    arguments: { root: tmpRoot, id: 2, status: "paused" }
  });
  const pausedPlans = await request("tools/call", {
    name: "proteus_list_records",
    arguments: { root: tmpRoot, recordType: "rounds", status: "paused" }
  });
  if (!String(pausedPlans.content?.[0]?.text ?? "").includes('"status": "paused"')) {
    throw new Error("proteus_update_round did not pause a round");
  }
  await request("tools/call", {
    name: "proteus_update_round",
    arguments: { root: tmpRoot, id: 2, status: "active" }
  });
  await request("tools/call", {
    name: "proteus_plan_round",
    arguments: { root: tmpRoot, objective: "MCP queued planned round", status: "planned" }
  });
  const bulkRoundUpdate = await request("tools/call", {
    name: "proteus_update_rounds",
    arguments: { root: tmpRoot, fromStatus: "planned", status: "superseded" }
  });
  if (!String(bulkRoundUpdate.content?.[0]?.text ?? "").includes('"updated": 1')) {
    throw new Error("proteus_update_rounds did not update planned rounds");
  }
  const surfaces = await request("tools/call", {
    name: "proteus_list_records",
    arguments: { root: tmpRoot, recordType: "surfaces", text: "daemon" }
  });
  if (!String(surfaces.content?.[0]?.text ?? "").includes("Smoke daemon protocol surface")) {
    throw new Error("proteus_list_records did not return recorded surface");
  }
  const hypothesis = await request("tools/call", {
    name: "proteus_record_hypothesis",
    arguments: {
      root: tmpRoot,
      title: "MCP smoke hypothesis",
      primitive: "Smoke daemon protocol surface",
      attackerBoundary: "external request",
      impactClaim: "mcp smoke impact",
      heuristicFamily: "state transition",
      surfaceId: 1,
      score: 8
    }
  });
  const hypothesisText = String(hypothesis.content?.[0]?.text ?? "");
  if (
    !hypothesisText.includes("active_campaign_linked") ||
    !hypothesisText.includes("tracks_hypothesis") ||
    !hypothesisText.includes("similar_records_found")
  ) {
    throw new Error("proteus_record_hypothesis did not auto-link or warn about matching prior coverage");
  }
  const evidence = await request("tools/call", {
    name: "proteus_record_evidence",
    arguments: {
      root: tmpRoot,
      title: "MCP smoke evidence",
      kind: "command-output",
      body: "MCP smoke evidence body"
    }
  });
  const evidenceText = String(evidence.content?.[0]?.text ?? "");
  if (!evidenceText.includes("active_campaign_linked") || !evidenceText.includes("has_evidence")) {
    throw new Error("proteus_record_evidence did not auto-link to the active campaign");
  }
  const decision = await request("tools/call", {
    name: "proteus_record_decision",
    arguments: {
      root: tmpRoot,
      entityType: "hypothesis",
      entityId: 1,
      decision: "killed",
      reason: "MCP smoke hypothesis killed by evidence",
      evidenceIds: ["1"]
    }
  });
  const decisionText = String(decision.content?.[0]?.text ?? "");
  if (!decisionText.includes("active_campaign_linked") || !decisionText.includes("has_decision")) {
    throw new Error("proteus_record_decision did not auto-link to the active campaign");
  }
  if (decisionText.includes("decision_without_evidence")) {
    throw new Error("proteus_record_decision dropped numeric-string evidenceIds");
  }
  if (!decisionText.includes("record_status_requires_explicit_update") ||
      !decisionText.includes('"currentStatus": "live"') ||
      !decisionText.includes('"tool": "proteus_update_hypothesis"') ||
      !decisionText.includes('"pendingReview": true')) {
    throw new Error("proteus_record_decision did not expose the pending explicit lifecycle repair");
  }
  const decisionRecord = await request("tools/call", {
    name: "proteus_get_record",
    arguments: { root: tmpRoot, entityType: "decision", entityId: 1 }
  });
  if (!String(decisionRecord.content?.[0]?.text ?? "").includes('"evidenceIds": [\n    1\n  ]')) {
    throw new Error("proteus_get_record did not preserve numeric-string decision evidenceIds");
  }
  const hypothesisAfterDecision = await request("tools/call", {
    name: "proteus_get_record",
    arguments: { root: tmpRoot, entityType: "hypothesis", entityId: 1 }
  });
  if (!String(hypothesisAfterDecision.content?.[0]?.text ?? "").includes('"status": "live"')) {
    throw new Error("proteus_record_decision implicitly changed hypothesis status");
  }
  const duplicateHypothesis = await request("tools/call", {
    name: "proteus_record_hypothesis",
    arguments: {
      root: tmpRoot,
      title: "MCP smoke hypothesis",
      primitive: "Smoke daemon protocol surface",
      attackerBoundary: "external request",
      impactClaim: "mcp smoke impact",
      heuristicFamily: "state transition",
      surfaceId: 1,
      score: 7
    }
  });
  const duplicateHypothesisText = String(duplicateHypothesis.content?.[0]?.text ?? "");
  if (!duplicateHypothesisText.includes("possible_stale_structured_status") ||
      !duplicateHypothesisText.includes('"entityId": 1') ||
      !duplicateHypothesisText.includes('"tool": "proteus_update_hypothesis"') ||
      !duplicateHypothesisText.includes('"newerDecisionCount": 1') ||
      !duplicateHypothesisText.includes('"entityType": "decision"')) {
    throw new Error("proteus_record_hypothesis did not direct a possible duplicate to the prior stale record");
  }
  const sameStatusReconciliation = await request("tools/call", {
    name: "proteus_update_hypothesis",
    arguments: { root: tmpRoot, id: "H1", status: "live" }
  });
  const sameStatusReconciliationText = String(sameStatusReconciliation.content?.[0]?.text ?? "");
  if (!sameStatusReconciliationText.includes('"fromStatus": "live"') ||
      !sameStatusReconciliationText.includes('"toStatus": "live"')) {
    throw new Error("proteus_update_hypothesis did not allow explicit same-status reconciliation");
  }
  const reconciledSameStatusQuery = await request("tools/call", {
    name: "proteus_query_similar",
    arguments: { root: tmpRoot, text: "MCP smoke hypothesis", limit: 5 }
  });
  if (String(reconciledSameStatusQuery.content?.[0]?.text ?? "").includes("possible_stale_structured_status")) {
    throw new Error("same-status hypothesis update did not reconcile the pending decision marker");
  }
  const rejectedBranchIdAsHypothesis = await requestFail("tools/call", {
    name: "proteus_update_hypothesis",
    arguments: { root: tmpRoot, id: "B1", status: "discarded" }
  });
  if (!rejectedBranchIdAsHypothesis.includes("Hypothesis id must be")) {
    throw new Error("proteus_update_hypothesis accepted a branch-prefixed id");
  }
  const discardedHypothesis = await request("tools/call", {
    name: "proteus_update_hypothesis",
    arguments: { root: tmpRoot, id: "H1", status: "discarded" }
  });
  const discardedHypothesisText = String(discardedHypothesis.content?.[0]?.text ?? "");
  if (!discardedHypothesisText.includes('"fromStatus": "live"') ||
      !discardedHypothesisText.includes('"toStatus": "discarded"') ||
      !discardedHypothesisText.includes('"status": "discarded"')) {
    throw new Error("proteus_update_hypothesis did not return and persist the explicit transition");
  }
  const reconciledSimilar = await request("tools/call", {
    name: "proteus_query_similar",
    arguments: { root: tmpRoot, text: "MCP smoke hypothesis", limit: 5 }
  });
  const reconciledSimilarText = String(reconciledSimilar.content?.[0]?.text ?? "");
  if (reconciledSimilarText.includes("possible_stale_structured_status") ||
      !reconciledSimilarText.includes('"reconciledDecisionId": 1')) {
    throw new Error("proteus_update_hypothesis did not reconcile the earlier decision marker");
  }
  const branchDecision = await request("tools/call", {
    name: "proteus_record_decision",
    arguments: {
      root: tmpRoot,
      entityType: "hypothesis_branch",
      entityId: 1,
      decision: "Confirm B1 mechanism and keep it in testing; do not promote the generic candidate as a finding yet.",
      reason: "MCP smoke negative promotion decision",
      evidenceIds: ["1"]
    }
  });
  const branchDecisionText = String(branchDecision.content?.[0]?.text ?? "");
  if (!branchDecisionText.includes('"entityType": "decision"') || !branchDecisionText.includes('"updated": []')) {
    throw new Error("proteus_record_decision was not append-only");
  }
  if (!branchDecisionText.includes("record_status_requires_explicit_update") ||
      !branchDecisionText.includes('"currentStatus": "testing"') ||
      !branchDecisionText.includes('"tool": "proteus_update_branch"') ||
      !branchDecisionText.includes('"pendingReview": true')) {
    throw new Error("proteus_record_decision did not expose the pending branch lifecycle repair");
  }
  const unchangedBranch = await request("tools/call", {
    name: "proteus_get_record",
    arguments: { root: tmpRoot, entityType: "branch", entityId: 1 }
  });
  if (!String(unchangedBranch.content?.[0]?.text ?? "").includes('"status": "testing"')) {
    throw new Error("proteus_record_decision inferred branch status from free-form text");
  }
  const explicitKill = await request("tools/call", {
    name: "proteus_update_branch",
    arguments: { root: tmpRoot, id: 1, status: "killed" }
  });
  const explicitKillText = String(explicitKill.content?.[0]?.text ?? "");
  if (!explicitKillText.includes('"fromStatus": "testing"') || !explicitKillText.includes('"toStatus": "killed"')) {
    throw new Error("proteus_update_branch did not report the explicit status transition");
  }
  const reconciledBranchSimilar = await request("tools/call", {
    name: "proteus_query_similar",
    arguments: { root: tmpRoot, text: "Smoke branch", limit: 5 }
  });
  if (String(reconciledBranchSimilar.content?.[0]?.text ?? "").includes("possible_stale_structured_status")) {
    throw new Error("proteus_update_branch did not reconcile the pending decision marker");
  }
  const agentOutput = await request("tools/call", {
    name: "proteus_record_agent_output",
    arguments: {
      root: tmpRoot,
      roundId: 1,
      codename: "Argus",
      roleFamily: "host-subagent-label-should-be-normalized-away",
      assignedSurface: "Smoke daemon protocol surface",
      coveredSurface: ["daemon.ts"],
      liveCandidates: ["MCP smoke hypothesis"],
      killedHypotheses: [],
      probes: ["read daemon.ts"],
      uncoveredAreas: [],
      validationStatus: "unvalidated"
    }
  });
  const agentOutputText = String(agentOutput.content?.[0]?.text ?? "");
  if (!agentOutputText.includes("active_campaign_linked") || !agentOutputText.includes("has_agent_output")) {
    throw new Error("proteus_record_agent_output did not auto-link to the active campaign");
  }
  const agentOutputJson = JSON.parse(agentOutputText);
  const agentOutputRecord = await request("tools/call", {
    name: "proteus_get_record",
    arguments: { root: tmpRoot, entityType: "agent_output", entityId: agentOutputJson.record.entityId }
  });
  const agentOutputRecordJson = JSON.parse(String(agentOutputRecord.content?.[0]?.text ?? "{}"));
  const normalizedAgentOutput = agentOutputRecordJson.record ?? agentOutputRecordJson;
  if (normalizedAgentOutput.codename !== "argus" || normalizedAgentOutput.roleFamily !== "component-level-review") {
    throw new Error("proteus_record_agent_output did not normalize display-name codename to canonical Proteus role");
  }
  const roles = await request("tools/call", { name: "proteus_roles", arguments: {} });
  if (!String(roles.content?.[0]?.text ?? "").includes("Argus")) {
    throw new Error("proteus_roles did not return role definitions");
  }
  await request("tools/call", {
    name: "proteus_record_global_learning",
    arguments: {
      root: tmpRoot,
      category: "validation_pattern",
      scope: "mcp,smoke",
      title: "MCP global learning",
      body: "MCP smoke learning body",
      tags: ["mcp", "smoke"]
    }
  });
  const globalLearning = await request("tools/call", {
    name: "proteus_query_global_learnings",
    arguments: { text: "MCP", scope: "smoke" }
  });
  if (!String(globalLearning.content?.[0]?.text ?? "").includes("MCP global learning")) {
    throw new Error("proteus_query_global_learnings did not return expected learning");
  }
  const coverage = await request("tools/call", {
    name: "proteus_query_duplicates",
    arguments: { root: tmpRoot, text: "Smoke daemon protocol surface", limit: 5 }
  });
  const coverageText = String(coverage.content?.[0]?.text ?? "");
  if (
    !coverageText.includes('"entityType": "source"') ||
    !coverageText.includes('"entityType": "surface"') ||
    coverageText.includes('"entityType": "round"')
  ) {
    throw new Error("proteus_query_duplicates did not combine source and structured prior research coverage");
  }
  const similar = await request("tools/call", {
    name: "proteus_query_similar",
    arguments: { root: tmpRoot, text: "Smoke daemon protocol surface", limit: 5 }
  });
  const similarText = String(similar.content?.[0]?.text ?? "");
  if (!similarText.includes("duplicateCoverage") || !similarText.includes("memoryMatches")) {
    throw new Error("proteus_query_similar did not return duplicate and memory sections");
  }
  const gate = await request("tools/call", {
    name: "proteus_record_gate",
    arguments: {
      root: tmpRoot,
      entityType: "hypothesis",
      entityId: 1,
      gate: "G1 root cause in target",
      status: "pending",
      summary: "MCP gate smoke",
      evidenceIds: ["1"]
    }
  });
  const gateText = String(gate.content?.[0]?.text ?? "");
  if (!gateText.includes("active_campaign_linked") || !gateText.includes("has_validation_gate")) {
    throw new Error("proteus_record_gate did not auto-link to the active campaign");
  }
  const gates = await request("tools/call", {
    name: "proteus_list_records",
    arguments: { root: tmpRoot, recordType: "gates", entityType: "hypothesis", entityId: 1 }
  });
  if (!String(gates.content?.[0]?.text ?? "").includes("MCP gate smoke")) {
    throw new Error("proteus_list_records did not return recorded gate");
  }
  const record = await request("tools/call", {
    name: "proteus_get_record",
    arguments: { root: tmpRoot, entityType: "round", entityId: 2 }
  });
  const recordText = String(record.content?.[0]?.text ?? "");
  if (!recordText.includes('"entityType": "round"') || !recordText.includes("Smoke daemon protocol surface")) {
    throw new Error("proteus_get_record did not return full record");
  }
  const revisit = await request("tools/call", {
    name: "proteus_query_revisit",
    arguments: { root: tmpRoot, surface: "Smoke daemon protocol surface" }
  });
  if (!String(revisit.content?.[0]?.text ?? "").includes("Smoke daemon protocol surface")) {
    throw new Error("proteus_query_revisit did not return recorded surface");
  }
  await request("tools/call", {
    name: "proteus_chimera_stop_server",
    arguments: { root: tmpRoot }
  });

  console.log(`Proteus MCP smoke test passed: ${tmpRoot}`);
} finally {
  child.stdin.end();
  child.kill();
  await waitForExit(child, 2000);
  killMockOpenCodeServers();
  rmTemp(tmpRoot);
  rmTemp(globalRoot);
  rmTemp(mergeSourceRoot);
}

function waitForExit(childProcess, timeoutMs) {
  if (childProcess.exitCode !== null || childProcess.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    childProcess.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function waitForFile(filePath, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (fs.existsSync(filePath)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for file: ${filePath}`);
}

function rmTemp(target) {
  let lastError = null;
  const attempts = process.platform === "win32" ? 8 : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
      return;
    } catch (error) {
      lastError = error;
      if (process.platform !== "win32") throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
  if (lastError) {
    console.warn(`warning: could not remove temp path ${target}: ${lastError.message}`);
  }
}

function killMockOpenCodeServers() {
  if (process.platform !== "win32") return;
  try {
    execFileSync("powershell.exe", [
      "-NoProfile",
      "-Command",
      "$mock=$env:PROTEUS_SMOKE_MOCK_OPENCODE; " +
      "Get-CimInstance Win32_Process | " +
      "Where-Object { $mock -and $_.CommandLine -like ('*' + $mock + '* serve *') } | " +
      "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    ], {
      env: { ...process.env, PROTEUS_SMOKE_MOCK_OPENCODE: mockOpenCode },
      stdio: "ignore"
    });
  } catch {
    // Best-effort cleanup for mock servers started by this smoke test.
  }
}
