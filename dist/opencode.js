"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.installOpenCodeSupport = installOpenCodeSupport;
exports.doctorOpenCodeSupport = doctorOpenCodeSupport;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const paths_1 = require("./paths");
const SKILL_ALIASES = [
    {
        source: "continuous-vuln-research",
        target: "proteus",
        description: "Coordinate Proteus continuous vulnerability research with memory, campaigns, delegation, validation gates, and report-grade discipline."
    },
    {
        source: "chaining",
        target: "proteus-chaining",
        description: "Develop non-obvious Proteus exploit chains from primitives, side effects, state drift, and component coupling."
    },
    {
        source: "checkpoint",
        target: "proteus-checkpoint",
        description: "Compress Proteus campaign or round state into a concise checkpoint with facts, killed paths, pivots, and next moves."
    },
    {
        source: "codebase-research",
        target: "proteus-codebase-research",
        description: "Map a codebase for Proteus research through architecture, dataflow, trust boundaries, invariants, and high-ROI branch material."
    },
    {
        source: "fuzzing",
        target: "proteus-fuzzing",
        description: "Design calibrated Proteus fuzzing and differential probes that learn input behavior instead of spraying generic payloads."
    },
    {
        source: "poc-exploit",
        target: "proteus-poc-exploit",
        description: "Build realistic Proteus PoC plans, labs, negative controls, and exploitability evidence for concrete candidates."
    },
    {
        source: "web-intel",
        target: "proteus-web-intel",
        description: "Gather Proteus security intelligence for known status, timelines, advisories, changelogs, docs, and duplicate risk."
    },
    {
        source: "web-research",
        target: "proteus-web-research",
        description: "Conduct authorized Proteus web research with campaign memory, chaining, fuzzing, intel, and PoC heuristics."
    }
];
function installOpenCodeSupport(root, options = {}) {
    const targetRoot = node_path_1.default.resolve(root);
    const result = {
        root: targetRoot,
        configPath: node_path_1.default.join(targetRoot, "opencode.json"),
        created: [],
        updated: [],
        skipped: [],
        advisories: []
    };
    (0, paths_1.ensureDir)(targetRoot);
    installOpenCodeConfig(targetRoot, result, options);
    installOpenCodeInstructions(targetRoot, result, options);
    installOpenCodeCommand(targetRoot, result, options);
    installOpenCodeSkills(targetRoot, result, options);
    installOpenCodeAgents(targetRoot, result, options);
    installOpenCodeTemplates(targetRoot, result, options);
    return result;
}
function doctorOpenCodeSupport(root) {
    const targetRoot = node_path_1.default.resolve(root);
    const configPath = node_path_1.default.join(targetRoot, "opencode.json");
    const configRead = readJsonConfig(configPath);
    const opencode = detectOpenCode();
    const result = {
        root: targetRoot,
        opencode,
        config: {
            path: configPath,
            exists: node_fs_1.default.existsSync(configPath),
            validJson: configRead.ok,
            hasProteusMcp: hasProteusMcp(configRead.value),
            hasProteusInstructions: hasProteusInstructions(configRead.value)
        },
        assets: {
            commands: listNames(node_path_1.default.join(targetRoot, ".opencode", "commands"), ".md"),
            agents: listNames(node_path_1.default.join(targetRoot, ".opencode", "agents"), ".md"),
            skills: listSkillNames(node_path_1.default.join(targetRoot, ".opencode", "skills")),
            templates: listNames(node_path_1.default.join(targetRoot, ".opencode", "templates"))
        },
        ok: false,
        advisories: []
    };
    if (!opencode.found)
        result.advisories.push("OpenCode CLI was not found on PATH.");
    if (!result.config.exists)
        result.advisories.push("opencode.json is missing. Run `proteus opencode install --root <path>`.");
    if (result.config.exists && !result.config.validJson)
        result.advisories.push("opencode.json is not valid JSON. Proteus will not modify JSONC/commented configs automatically.");
    if (!result.config.hasProteusMcp)
        result.advisories.push("opencode.json does not enable the Proteus MCP server.");
    if (!result.config.hasProteusInstructions)
        result.advisories.push("opencode.json does not reference the Proteus OpenCode instructions.");
    for (const required of SKILL_ALIASES.map((item) => item.target)) {
        if (!result.assets.skills.includes(required))
            result.advisories.push(`Missing OpenCode skill: ${required}`);
    }
    if (!result.assets.commands.includes("proteus"))
        result.advisories.push("Missing OpenCode command: /proteus");
    result.ok = opencode.found && result.config.validJson && result.config.hasProteusMcp && result.config.hasProteusInstructions && result.advisories.length === 0;
    return result;
}
function installOpenCodeConfig(targetRoot, result, options) {
    const configPath = node_path_1.default.join(targetRoot, "opencode.json");
    const existing = readJsonConfig(configPath);
    if (node_fs_1.default.existsSync(configPath) && !existing.ok) {
        result.skipped.push(configPath);
        result.advisories.push("Existing opencode.json is not valid JSON. Add the Proteus MCP and instructions manually or rerun with --force to replace it.");
        return;
    }
    const config = existing.value ?? {};
    config.$schema = typeof config.$schema === "string" ? config.$schema : "https://opencode.ai/config.json";
    config.mcp = isObject(config.mcp) ? config.mcp : {};
    config.mcp.proteus = {
        type: "local",
        command: ["proteus-mcp"],
        enabled: true,
        timeout: 15000
    };
    const instructions = Array.isArray(config.instructions) ? config.instructions.filter((item) => typeof item === "string") : [];
    if (!instructions.includes(".opencode/instructions/proteus.md"))
        instructions.push(".opencode/instructions/proteus.md");
    config.instructions = instructions;
    config.permission = isObject(config.permission) ? config.permission : {};
    config.permission.skill = isObject(config.permission.skill) ? config.permission.skill : {};
    config.permission.skill["proteus*"] = "allow";
    writeManagedFile(configPath, `${JSON.stringify(config, null, 2)}\n`, result, options);
}
function installOpenCodeInstructions(targetRoot, result, options) {
    const instructions = `# Proteus OpenCode Runtime

Proteus is available in this OpenCode project through:

- the \`proteus\` skill for coordinator-led continuous vulnerability research;
- specialist skills named \`proteus-chaining\`, \`proteus-codebase-research\`, \`proteus-fuzzing\`, \`proteus-web-intel\`, \`proteus-web-research\`, \`proteus-poc-exploit\`, and \`proteus-checkpoint\`;
- the local \`proteus\` MCP server, started through \`proteus-mcp\`;
- the \`/proteus\` command for starting the coordinator workflow.

When the user asks for Proteus research, load the \`proteus\` skill first. Use the specialist skills only when the current branch needs that specific method. Prefer MCP tools when available, and fall back to the \`proteus\` CLI when a tool is unavailable.
`;
    writeManagedFile(node_path_1.default.join(targetRoot, ".opencode", "instructions", "proteus.md"), instructions, result, options);
}
function installOpenCodeCommand(targetRoot, result, options) {
    const source = node_path_1.default.join(proteusPluginRoot(), "commands", "proteus.md");
    const command = node_fs_1.default.existsSync(source)
        ? node_fs_1.default.readFileSync(source, "utf8")
        : `---\ndescription: Run Proteus continuous vulnerability research for the current target.\n---\n\nLoad the proteus skill and run the coordinator workflow for: $ARGUMENTS\n`;
    writeManagedFile(node_path_1.default.join(targetRoot, ".opencode", "commands", "proteus.md"), command, result, options);
}
function installOpenCodeSkills(targetRoot, result, options) {
    const skillsRoot = node_path_1.default.join(proteusPluginRoot(), "skills");
    for (const alias of SKILL_ALIASES) {
        const source = node_path_1.default.join(skillsRoot, alias.source, "SKILL.md");
        if (!node_fs_1.default.existsSync(source)) {
            result.advisories.push(`Packaged Proteus skill missing: ${alias.source}`);
            continue;
        }
        const content = rewriteSkillFrontmatter(node_fs_1.default.readFileSync(source, "utf8"), alias.target, alias.description);
        writeManagedFile(node_path_1.default.join(targetRoot, ".opencode", "skills", alias.target, "SKILL.md"), content, result, options);
    }
}
function installOpenCodeAgents(targetRoot, result, options) {
    const agentsRoot = node_path_1.default.join(proteusPluginRoot(), "agents");
    if (!node_fs_1.default.existsSync(agentsRoot))
        return;
    for (const entry of node_fs_1.default.readdirSync(agentsRoot, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".md"))
            continue;
        const source = node_path_1.default.join(agentsRoot, entry.name);
        const content = rewriteAgentFrontmatter(node_fs_1.default.readFileSync(source, "utf8"));
        writeManagedFile(node_path_1.default.join(targetRoot, ".opencode", "agents", entry.name), content, result, options);
    }
}
function installOpenCodeTemplates(targetRoot, result, options) {
    const templatesRoot = node_path_1.default.join(proteusPluginRoot(), "templates");
    if (!node_fs_1.default.existsSync(templatesRoot))
        return;
    for (const entry of node_fs_1.default.readdirSync(templatesRoot, { withFileTypes: true })) {
        if (!entry.isFile())
            continue;
        const source = node_path_1.default.join(templatesRoot, entry.name);
        writeManagedFile(node_path_1.default.join(targetRoot, ".opencode", "templates", entry.name), node_fs_1.default.readFileSync(source, "utf8"), result, options);
    }
}
function rewriteSkillFrontmatter(content, name, description) {
    const body = stripFrontmatter(content);
    return `---\nname: ${name}\ndescription: ${description}\ncompatibility: opencode\nmetadata:\n  source: proteus\n---\n${body}`;
}
function rewriteAgentFrontmatter(content) {
    const parsed = parseFrontmatter(content);
    if (!parsed)
        return content;
    const lines = parsed.frontmatter.split(/\r?\n/).filter((line) => !/^mode\s*:/.test(line) && !/^permission\s*:/.test(line));
    const nameIndex = lines.findIndex((line) => /^name\s*:/.test(line));
    if (nameIndex >= 0)
        lines.splice(nameIndex, 1);
    const frontmatter = [...lines, "mode: subagent"].join("\n");
    return `---\n${frontmatter}\n---\n${parsed.body}`;
}
function stripFrontmatter(content) {
    const parsed = parseFrontmatter(content);
    return parsed ? parsed.body : content;
}
function parseFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!match)
        return null;
    return {
        frontmatter: match[1] ?? "",
        body: content.slice(match[0].length)
    };
}
function writeManagedFile(filePath, content, result, options) {
    (0, paths_1.ensureDir)(node_path_1.default.dirname(filePath));
    if (node_fs_1.default.existsSync(filePath) && !options.force) {
        const current = node_fs_1.default.readFileSync(filePath, "utf8");
        if (current === content) {
            result.skipped.push(filePath);
            return;
        }
        result.skipped.push(filePath);
        result.advisories.push(`Skipped existing file: ${filePath}. Rerun with --force to update it.`);
        return;
    }
    const existed = node_fs_1.default.existsSync(filePath);
    node_fs_1.default.writeFileSync(filePath, content);
    (existed ? result.updated : result.created).push(filePath);
}
function readJsonConfig(filePath) {
    if (!node_fs_1.default.existsSync(filePath))
        return { ok: true, value: null };
    try {
        const parsed = JSON.parse(node_fs_1.default.readFileSync(filePath, "utf8"));
        if (!isObject(parsed))
            return { ok: false, value: null };
        return { ok: true, value: parsed };
    }
    catch {
        return { ok: false, value: null };
    }
}
function detectOpenCode() {
    const command = process.env.OPENCODE_COMMAND?.trim() || "opencode";
    try {
        const version = (0, node_child_process_1.execFileSync)(command, ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
        return { found: true, version };
    }
    catch (firstError) {
        try {
            const version = (0, node_child_process_1.execSync)(`${quoteShellCommand(command)} --version`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
            return { found: true, version };
        }
        catch {
            return { found: false, error: firstError instanceof Error ? firstError.message : String(firstError) };
        }
    }
}
function hasProteusMcp(config) {
    if (!config || !isObject(config.mcp))
        return false;
    const proteus = config.mcp.proteus;
    return isObject(proteus) && proteus.type === "local" && Array.isArray(proteus.command) && proteus.command.includes("proteus-mcp") && proteus.enabled !== false;
}
function hasProteusInstructions(config) {
    return Boolean(config && Array.isArray(config.instructions) && config.instructions.includes(".opencode/instructions/proteus.md"));
}
function listNames(dir, suffix) {
    if (!node_fs_1.default.existsSync(dir))
        return [];
    return node_fs_1.default.readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && (!suffix || entry.name.endsWith(suffix)))
        .map((entry) => suffix ? entry.name.slice(0, -suffix.length) : entry.name)
        .sort();
}
function listSkillNames(dir) {
    if (!node_fs_1.default.existsSync(dir))
        return [];
    return node_fs_1.default.readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && node_fs_1.default.existsSync(node_path_1.default.join(dir, entry.name, "SKILL.md")))
        .map((entry) => entry.name)
        .sort();
}
function proteusPluginRoot() {
    return node_path_1.default.resolve(__dirname, "..", "plugins", "proteus");
}
function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function quoteShellCommand(command) {
    if (/^[A-Za-z0-9_.:/\\-]+$/.test(command))
        return command;
    return `"${command.replace(/"/g, '\\"')}"`;
}
