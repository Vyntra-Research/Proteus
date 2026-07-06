import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ensureDir } from "./paths";

type JsonObject = Record<string, unknown>;

export interface OpenCodeInstallOptions {
  force?: boolean;
}

export interface OpenCodeInstallResult {
  root: string;
  configPath: string;
  created: string[];
  updated: string[];
  skipped: string[];
  advisories: string[];
}

export interface OpenCodeDoctorResult {
  root: string;
  opencode: {
    found: boolean;
    version?: string;
    error?: string;
  };
  config: {
    path: string;
    exists: boolean;
    validJson: boolean;
    hasProteusMcp: boolean;
    hasProteusInstructions: boolean;
  };
  assets: {
    commands: string[];
    agents: string[];
    skills: string[];
    templates: string[];
  };
  ok: boolean;
  advisories: string[];
}

const SKILL_ALIASES = [
  {
    source: "continuous-vuln-research",
    target: "proteus",
    description:
      "Coordinate Proteus continuous vulnerability research with memory, campaigns, delegation, validation gates, and report-grade discipline."
  },
  {
    source: "chaining",
    target: "proteus-chaining",
    description:
      "Develop non-obvious Proteus exploit chains from primitives, side effects, state drift, and component coupling."
  },
  {
    source: "checkpoint",
    target: "proteus-checkpoint",
    description:
      "Compress Proteus campaign or round state into a concise checkpoint with facts, killed paths, pivots, and next moves."
  },
  {
    source: "codebase-research",
    target: "proteus-codebase-research",
    description:
      "Map a codebase for Proteus research through architecture, dataflow, trust boundaries, invariants, and high-ROI branch material."
  },
  {
    source: "fuzzing",
    target: "proteus-fuzzing",
    description:
      "Design calibrated Proteus fuzzing and differential probes that learn input behavior instead of spraying generic payloads."
  },
  {
    source: "poc-exploit",
    target: "proteus-poc-exploit",
    description:
      "Build realistic Proteus PoC plans, labs, negative controls, and exploitability evidence for concrete candidates."
  },
  {
    source: "web-intel",
    target: "proteus-web-intel",
    description:
      "Gather Proteus security intelligence for known status, timelines, advisories, changelogs, docs, and duplicate risk."
  },
  {
    source: "web-research",
    target: "proteus-web-research",
    description:
      "Conduct authorized Proteus web research with campaign memory, chaining, fuzzing, intel, and PoC heuristics."
  }
];

export function installOpenCodeSupport(root: string, options: OpenCodeInstallOptions = {}): OpenCodeInstallResult {
  const targetRoot = path.resolve(root);
  const result: OpenCodeInstallResult = {
    root: targetRoot,
    configPath: path.join(targetRoot, "opencode.json"),
    created: [],
    updated: [],
    skipped: [],
    advisories: []
  };
  ensureDir(targetRoot);
  installOpenCodeConfig(targetRoot, result, options);
  installOpenCodeInstructions(targetRoot, result, options);
  installOpenCodeCommand(targetRoot, result, options);
  installOpenCodeSkills(targetRoot, result, options);
  installOpenCodeAgents(targetRoot, result, options);
  installOpenCodeTemplates(targetRoot, result, options);
  return result;
}

export function doctorOpenCodeSupport(root: string): OpenCodeDoctorResult {
  const targetRoot = path.resolve(root);
  const configPath = path.join(targetRoot, "opencode.json");
  const configRead = readJsonConfig(configPath);
  const opencode = detectOpenCode();
  const result: OpenCodeDoctorResult = {
    root: targetRoot,
    opencode,
    config: {
      path: configPath,
      exists: fs.existsSync(configPath),
      validJson: configRead.ok,
      hasProteusMcp: hasProteusMcp(configRead.value),
      hasProteusInstructions: hasProteusInstructions(configRead.value)
    },
    assets: {
      commands: listNames(path.join(targetRoot, ".opencode", "commands"), ".md"),
      agents: listNames(path.join(targetRoot, ".opencode", "agents"), ".md"),
      skills: listSkillNames(path.join(targetRoot, ".opencode", "skills")),
      templates: listNames(path.join(targetRoot, ".opencode", "templates"))
    },
    ok: false,
    advisories: []
  };
  if (!opencode.found) result.advisories.push("OpenCode CLI was not found on PATH.");
  if (!result.config.exists) result.advisories.push("opencode.json is missing. Run `proteus opencode install --root <path>`.");
  if (result.config.exists && !result.config.validJson) result.advisories.push("opencode.json is not valid JSON. Proteus will not modify JSONC/commented configs automatically.");
  if (!result.config.hasProteusMcp) result.advisories.push("opencode.json does not enable the Proteus MCP server.");
  if (!result.config.hasProteusInstructions) result.advisories.push("opencode.json does not reference the Proteus OpenCode instructions.");
  for (const required of SKILL_ALIASES.map((item) => item.target)) {
    if (!result.assets.skills.includes(required)) result.advisories.push(`Missing OpenCode skill: ${required}`);
  }
  if (!result.assets.commands.includes("proteus")) result.advisories.push("Missing OpenCode command: /proteus");
  result.ok = opencode.found && result.config.validJson && result.config.hasProteusMcp && result.config.hasProteusInstructions && result.advisories.length === 0;
  return result;
}

function installOpenCodeConfig(targetRoot: string, result: OpenCodeInstallResult, options: OpenCodeInstallOptions): void {
  const configPath = path.join(targetRoot, "opencode.json");
  const existing = readJsonConfig(configPath);
  if (fs.existsSync(configPath) && !existing.ok) {
    result.skipped.push(configPath);
    result.advisories.push("Existing opencode.json is not valid JSON. Add the Proteus MCP and instructions manually or rerun with --force to replace it.");
    return;
  }
  const config = existing.value ?? {};
  config.$schema = typeof config.$schema === "string" ? config.$schema : "https://opencode.ai/config.json";
  config.mcp = isObject(config.mcp) ? config.mcp : {};
  (config.mcp as JsonObject).proteus = {
    type: "local",
    command: ["proteus-mcp"],
    enabled: true,
    timeout: 15000
  };
  const instructions = Array.isArray(config.instructions) ? config.instructions.filter((item): item is string => typeof item === "string") : [];
  if (!instructions.includes(".opencode/instructions/proteus.md")) instructions.push(".opencode/instructions/proteus.md");
  config.instructions = instructions;
  config.permission = isObject(config.permission) ? config.permission : {};
  (config.permission as JsonObject).skill = isObject((config.permission as JsonObject).skill) ? (config.permission as JsonObject).skill : {};
  ((config.permission as JsonObject).skill as JsonObject)["proteus*"] = "allow";
  writeManagedFile(configPath, `${JSON.stringify(config, null, 2)}\n`, result, options);
}

function installOpenCodeInstructions(targetRoot: string, result: OpenCodeInstallResult, options: OpenCodeInstallOptions): void {
  const instructions = `# Proteus OpenCode Runtime

Proteus is available in this OpenCode project through:

- the \`proteus\` skill for coordinator-led continuous vulnerability research;
- specialist skills named \`proteus-chaining\`, \`proteus-codebase-research\`, \`proteus-fuzzing\`, \`proteus-web-intel\`, \`proteus-web-research\`, \`proteus-poc-exploit\`, and \`proteus-checkpoint\`;
- the local \`proteus\` MCP server, started through \`proteus-mcp\`;
- the \`/proteus\` command for starting the coordinator workflow.

When the user asks for Proteus research, load the \`proteus\` skill first. Use the specialist skills only when the current branch needs that specific method. Prefer MCP tools when available, and fall back to the \`proteus\` CLI when a tool is unavailable.
`;
  writeManagedFile(path.join(targetRoot, ".opencode", "instructions", "proteus.md"), instructions, result, options);
}

function installOpenCodeCommand(targetRoot: string, result: OpenCodeInstallResult, options: OpenCodeInstallOptions): void {
  const source = path.join(proteusPluginRoot(), "commands", "proteus.md");
  const command = fs.existsSync(source)
    ? fs.readFileSync(source, "utf8")
    : `---\ndescription: Run Proteus continuous vulnerability research for the current target.\n---\n\nLoad the proteus skill and run the coordinator workflow for: $ARGUMENTS\n`;
  writeManagedFile(path.join(targetRoot, ".opencode", "commands", "proteus.md"), command, result, options);
}

function installOpenCodeSkills(targetRoot: string, result: OpenCodeInstallResult, options: OpenCodeInstallOptions): void {
  const skillsRoot = path.join(proteusPluginRoot(), "skills");
  for (const alias of SKILL_ALIASES) {
    const source = path.join(skillsRoot, alias.source, "SKILL.md");
    if (!fs.existsSync(source)) {
      result.advisories.push(`Packaged Proteus skill missing: ${alias.source}`);
      continue;
    }
    const content = rewriteSkillFrontmatter(fs.readFileSync(source, "utf8"), alias.target, alias.description);
    writeManagedFile(path.join(targetRoot, ".opencode", "skills", alias.target, "SKILL.md"), content, result, options);
  }
}

function installOpenCodeAgents(targetRoot: string, result: OpenCodeInstallResult, options: OpenCodeInstallOptions): void {
  const agentsRoot = path.join(proteusPluginRoot(), "agents");
  if (!fs.existsSync(agentsRoot)) return;
  for (const entry of fs.readdirSync(agentsRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const source = path.join(agentsRoot, entry.name);
    const content = rewriteAgentFrontmatter(fs.readFileSync(source, "utf8"));
    writeManagedFile(path.join(targetRoot, ".opencode", "agents", entry.name), content, result, options);
  }
}

function installOpenCodeTemplates(targetRoot: string, result: OpenCodeInstallResult, options: OpenCodeInstallOptions): void {
  const templatesRoot = path.join(proteusPluginRoot(), "templates");
  if (!fs.existsSync(templatesRoot)) return;
  for (const entry of fs.readdirSync(templatesRoot, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const source = path.join(templatesRoot, entry.name);
    writeManagedFile(path.join(targetRoot, ".opencode", "templates", entry.name), fs.readFileSync(source, "utf8"), result, options);
  }
}

function rewriteSkillFrontmatter(content: string, name: string, description: string): string {
  const body = stripFrontmatter(content);
  return `---\nname: ${name}\ndescription: ${description}\ncompatibility: opencode\nmetadata:\n  source: proteus\n---\n${body}`;
}

function rewriteAgentFrontmatter(content: string): string {
  const parsed = parseFrontmatter(content);
  if (!parsed) return content;
  const lines = parsed.frontmatter.split(/\r?\n/).filter((line) => !/^mode\s*:/.test(line) && !/^permission\s*:/.test(line));
  const nameIndex = lines.findIndex((line) => /^name\s*:/.test(line));
  if (nameIndex >= 0) lines.splice(nameIndex, 1);
  const frontmatter = [...lines, "mode: subagent"].join("\n");
  return `---\n${frontmatter}\n---\n${parsed.body}`;
}

function stripFrontmatter(content: string): string {
  const parsed = parseFrontmatter(content);
  return parsed ? parsed.body : content;
}

function parseFrontmatter(content: string): { frontmatter: string; body: string } | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;
  return {
    frontmatter: match[1] ?? "",
    body: content.slice(match[0].length)
  };
}

function writeManagedFile(filePath: string, content: string, result: OpenCodeInstallResult, options: OpenCodeInstallOptions): void {
  ensureDir(path.dirname(filePath));
  if (fs.existsSync(filePath) && !options.force) {
    const current = fs.readFileSync(filePath, "utf8");
    if (current === content) {
      result.skipped.push(filePath);
      return;
    }
    result.skipped.push(filePath);
    result.advisories.push(`Skipped existing file: ${filePath}. Rerun with --force to update it.`);
    return;
  }
  const existed = fs.existsSync(filePath);
  fs.writeFileSync(filePath, content);
  (existed ? result.updated : result.created).push(filePath);
}

function readJsonConfig(filePath: string): { ok: true; value: JsonObject | null } | { ok: false; value: null } {
  if (!fs.existsSync(filePath)) return { ok: true, value: null };
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
    if (!isObject(parsed)) return { ok: false, value: null };
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, value: null };
  }
}

function detectOpenCode(): OpenCodeDoctorResult["opencode"] {
  const command = process.env.OPENCODE_COMMAND?.trim() || "opencode";
  try {
    const version = execFileSync(command, ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    return { found: true, version };
  } catch (firstError) {
    try {
      const version = execSync(`${quoteShellCommand(command)} --version`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
      return { found: true, version };
    } catch {
      return { found: false, error: firstError instanceof Error ? firstError.message : String(firstError) };
    }
  }
}

function hasProteusMcp(config: JsonObject | null): boolean {
  if (!config || !isObject(config.mcp)) return false;
  const proteus = config.mcp.proteus;
  return isObject(proteus) && proteus.type === "local" && Array.isArray(proteus.command) && proteus.command.includes("proteus-mcp") && proteus.enabled !== false;
}

function hasProteusInstructions(config: JsonObject | null): boolean {
  return Boolean(config && Array.isArray(config.instructions) && config.instructions.includes(".opencode/instructions/proteus.md"));
}

function listNames(dir: string, suffix?: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && (!suffix || entry.name.endsWith(suffix)))
    .map((entry) => suffix ? entry.name.slice(0, -suffix.length) : entry.name)
    .sort();
}

function listSkillNames(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(dir, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
}

function proteusPluginRoot(): string {
  return path.resolve(__dirname, "..", "plugins", "proteus");
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function quoteShellCommand(command: string): string {
  if (/^[A-Za-z0-9_.:/\\-]+$/.test(command)) return command;
  return `"${command.replace(/"/g, '\\"')}"`;
}
