"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTargetRoot = resolveTargetRoot;
exports.vrosDir = vrosDir;
exports.memoryPath = memoryPath;
exports.exportsDir = exportsDir;
exports.labsDir = labsDir;
exports.chimeraDir = chimeraDir;
exports.chimeraSessionsDir = chimeraSessionsDir;
exports.chimeraSessionDir = chimeraSessionDir;
exports.globalVrosDir = globalVrosDir;
exports.globalMemoryPath = globalMemoryPath;
exports.globalExportsDir = globalExportsDir;
exports.globalChimeraDir = globalChimeraDir;
exports.globalChimeraConfigPath = globalChimeraConfigPath;
exports.ensureDir = ensureDir;
exports.toRelative = toRelative;
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
function resolveTargetRoot(input) {
    return node_path_1.default.resolve(input ?? process.cwd());
}
function vrosDir(targetRoot) {
    return node_path_1.default.join(targetRoot, ".vros");
}
function memoryPath(targetRoot) {
    return node_path_1.default.join(vrosDir(targetRoot), "memory.sqlite");
}
function exportsDir(targetRoot) {
    return node_path_1.default.join(vrosDir(targetRoot), "exports");
}
function labsDir(targetRoot) {
    return node_path_1.default.join(vrosDir(targetRoot), "labs");
}
function chimeraDir(targetRoot) {
    return node_path_1.default.join(vrosDir(targetRoot), "chimera");
}
function chimeraSessionsDir(targetRoot) {
    return node_path_1.default.join(chimeraDir(targetRoot), "sessions");
}
function chimeraSessionDir(targetRoot, publicId) {
    return node_path_1.default.join(chimeraSessionsDir(targetRoot), publicId);
}
function globalVrosDir() {
    return node_path_1.default.join(node_os_1.default.homedir(), ".vros");
}
function globalMemoryPath() {
    if (process.env.PROTEUS_GLOBAL_MEMORY_PATH) {
        return node_path_1.default.resolve(process.env.PROTEUS_GLOBAL_MEMORY_PATH);
    }
    return node_path_1.default.join(globalVrosDir(), "global.sqlite");
}
function globalExportsDir() {
    if (process.env.PROTEUS_GLOBAL_EXPORTS_DIR) {
        return node_path_1.default.resolve(process.env.PROTEUS_GLOBAL_EXPORTS_DIR);
    }
    return node_path_1.default.join(globalVrosDir(), "exports");
}
function globalChimeraDir() {
    if (process.env.PROTEUS_CHIMERA_DIR) {
        return node_path_1.default.resolve(process.env.PROTEUS_CHIMERA_DIR);
    }
    return node_path_1.default.join(globalVrosDir(), "chimera");
}
function globalChimeraConfigPath() {
    if (process.env.PROTEUS_CHIMERA_CONFIG_PATH) {
        return node_path_1.default.resolve(process.env.PROTEUS_CHIMERA_CONFIG_PATH);
    }
    return node_path_1.default.join(globalChimeraDir(), "config.json");
}
function ensureDir(dir) {
    node_fs_1.default.mkdirSync(dir, { recursive: true });
}
function toRelative(root, filePath) {
    const relative = node_path_1.default.relative(root, filePath);
    return relative.length === 0 ? "." : relative.replace(/\\/g, "/");
}
