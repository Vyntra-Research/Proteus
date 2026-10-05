"use strict";
/**
 * Cross-campaign effectiveness calibration.
 *
 * CAI Fluency lists "Autonomous System Monitoring" under Critique: detect drift
 * or degradation in the security system you deployed. Proteus had no way to look
 * at itself. It recorded hypotheses, killed them, promoted them, and never asked
 * whether the class it kept hunting was the class that ever paid off.
 *
 * This module answers that from existing memory. It reads `hypotheses` and
 * groups by `heuristic_family`, which the schema already carries but which has
 * been defaulting to "unknown", leaving calibration blind until agents tag.
 *
 * Two honesty constraints shape everything below.
 *
 * First, kill rate is not a quality metric. A high kill rate can mean rigorous
 * discipline that closed weak ideas quickly, or it can mean rounds burned on a
 * class that never paid. Without cost-per-hypothesis data those are
 * indistinguishable, so this module refuses to score them as failure and says
 * so.
 *
 * Second, there is no decision timestamp on a hypothesis row. Ordering by id
 * reflects creation order, not the moment a hypothesis was decided, so every
 * "recent" number here is a creation-order window and is labeled as one.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CALIBRATION_CAVEAT = void 0;
exports.resolveFamilyToPrior = resolveFamilyToPrior;
exports.buildCalibrationReport = buildCalibrationReport;
exports.renderCalibrationDigest = renderCalibrationDigest;
const class_playbooks_1 = require("./class-playbooks");
exports.CALIBRATION_CAVEAT = "Calibration measures recorded outcomes, not research quality. Kill rate is ambiguous without " +
    "cost data: fast kills are discipline, slow kills are waste, and this report cannot tell them apart. " +
    "'Recent' windows follow hypothesis id, which is creation order, not decision time. Small samples " +
    "are noise. A productive class is not a reason to hunt only that class, and an over-invested " +
    "class is a reason to revisit its revisit condition, not proof the class is absent from the target.";
const PROMOTED = ["promoted_to_poc", "report_grade"];
const KILLED = ["discarded"];
const OPEN = ["live", "candidate", "watchlist"];
const UNTAGGED = new Set(["", "unknown", "n/a", "na", "none", "unspecified", "tbd"]);
function normalize(value) {
    return (value ?? "").trim().toLowerCase();
}
function isUntagged(family) {
    return UNTAGGED.has(normalize(family));
}
function rate(part, whole) {
    return whole === 0 ? null : part / whole;
}
function round4(value) {
    return Math.round(value * 10000) / 10000;
}
/**
 * Resolves a free-text heuristic family against the class prior catalog.
 * Exact id wins, then a substring match on id or name. Planner surface families
 * resolve to every prior that covers that family, which is intentionally
 * ambiguous and reported as such by the caller.
 */
function resolveFamilyToPrior(heuristicFamily) {
    const needle = normalize(heuristicFamily);
    if (!needle)
        return { priorId: null, ambiguous: false };
    const catalog = (0, class_playbooks_1.listClassPriors)();
    const exact = catalog.find((prior) => normalize(prior.id) === needle);
    if (exact)
        return { priorId: exact.id, ambiguous: false };
    const partial = catalog.filter((prior) => normalize(prior.id).includes(needle) || needle.includes(normalize(prior.id)));
    if (partial.length === 1)
        return { priorId: partial[0].id, ambiguous: false };
    if (partial.length > 1)
        return { priorId: null, ambiguous: true };
    const byName = catalog.filter((prior) => normalize(prior.name).includes(needle) || needle.includes(normalize(prior.name)));
    if (byName.length === 1)
        return { priorId: byName[0].id, ambiguous: false };
    if (byName.length > 1)
        return { priorId: null, ambiguous: true };
    return { priorId: null, ambiguous: false };
}
function priorBySurfaceFamily(family) {
    const needle = normalize(family);
    return (0, class_playbooks_1.listClassPriors)()
        .filter((prior) => prior.surfaceFamilies.some((surfaceFamily) => normalize(surfaceFamily) === needle))
        .map((prior) => prior.id);
}
function buildWindow(rows, size) {
    const ordered = [...rows].sort((a, b) => b.id - a.id).slice(0, size);
    const promoted = ordered.filter((row) => PROMOTED.includes(row.status)).length;
    const killed = ordered.filter((row) => KILLED.includes(row.status)).length;
    const decided = promoted + killed;
    return {
        size: ordered.length,
        decided,
        promoted,
        killed,
        promoteRate: rate(promoted, decided)
    };
}
function verdictFor(total, decided, promoteRate, minDecidedForVerdict, productivePromoteRate) {
    if (total === 0)
        return "no-data";
    if (decided === 0)
        return "untested";
    if (decided < minDecidedForVerdict)
        return "insufficient-data";
    if (promoteRate !== null && promoteRate >= productivePromoteRate)
        return "productive";
    if (promoteRate === 0)
        return "over-invested";
    return "insufficient-data";
}
function adviceFor(verdict) {
    switch (verdict) {
        case "productive":
            return "This class has paid off here. Keep it in scope, and keep testing the class prior's technique shift rather than repeating approaches already killed.";
        case "over-invested":
            return "Decisions here produced no promotions. Either the framing was wrong or the class prior's required harness was never built. Check the revisit condition before spending another round; do not conclude the class is absent.";
        case "untested":
            return "Hypotheses recorded but none decided. Build the class prior's required harness; an undecided hypothesis is an unbuilt precondition, not a negative result.";
        case "insufficient-data":
            return "Too few decisions to judge. Keep going, or state the kill criteria now so the next round can decide rather than accumulate.";
        default:
            return "No hypotheses recorded for this family.";
    }
}
function buildCalibrationReport(hypotheses, options = {}) {
    const recentWindowSize = Math.max(1, options.recentWindowSize ?? 10);
    const minDecidedForVerdict = Math.max(1, options.minDecidedForVerdict ?? 3);
    const productivePromoteRate = options.productivePromoteRate ?? 0.25;
    const promoteCollapseDelta = 0.2;
    const byFamily = new Map();
    for (const row of hypotheses) {
        const key = row.heuristicFamily?.trim() || "unknown";
        const bucket = byFamily.get(key);
        if (bucket)
            bucket.push(row);
        else
            byFamily.set(key, [row]);
    }
    const untagged = hypotheses.filter((row) => isUntagged(row.heuristicFamily)).length;
    const signals = [];
    const unmappedFamilies = [];
    const classes = [];
    for (const [family, rows] of byFamily) {
        const statusCounts = {};
        for (const row of rows) {
            statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
        }
        const promotedCount = rows.filter((row) => PROMOTED.includes(row.status)).length;
        const killedCount = rows.filter((row) => KILLED.includes(row.status)).length;
        const openCount = rows.filter((row) => OPEN.includes(row.status)).length;
        const decided = promotedCount + killedCount;
        const promoteRate = rate(promotedCount, decided);
        const killRate = rate(killedCount, decided);
        const verdict = verdictFor(rows.length, decided, promoteRate, minDecidedForVerdict, productivePromoteRate);
        const recentWindow = buildWindow(rows, recentWindowSize);
        const promoteRateDelta = promoteRate !== null && recentWindow.promoteRate !== null
            ? round4(recentWindow.promoteRate - promoteRate)
            : null;
        const { priorId, ambiguous } = resolveFamilyToPrior(family);
        const surfaceFamilyPriors = priorId ? [] : priorBySurfaceFamily(family);
        let difficulty = null;
        let priorName = null;
        if (priorId) {
            const prior = (0, class_playbooks_1.getClassPrior)(priorId);
            priorName = prior.name;
            difficulty = prior.difficulty;
        }
        const calibration = {
            heuristicFamily: family,
            priorId,
            priorName,
            difficulty,
            total: rows.length,
            statusCounts,
            decided,
            promoted: promotedCount,
            killed: killedCount,
            open: openCount,
            promoteRate: promoteRate === null ? null : round4(promoteRate),
            killRate: killRate === null ? null : round4(killRate),
            verdict,
            advice: "",
            recentWindow: {
                ...recentWindow,
                promoteRate: recentWindow.promoteRate === null ? null : round4(recentWindow.promoteRate)
            },
            promoteRateDelta
        };
        calibration.advice = adviceFor(verdict);
        classes.push(calibration);
        if (!isUntagged(family) && !priorId && !ambiguous && surfaceFamilyPriors.length === 0) {
            unmappedFamilies.push(family);
        }
    }
    classes.sort((a, b) => {
        const order = (value) => value === "over-invested" ? 0 : value === "untested" ? 1 : value === "insufficient-data" ? 2 : value === "productive" ? 3 : 4;
        return order(a.verdict) - order(b.verdict) || b.total - a.total;
    });
    const totalPromoted = hypotheses.filter((row) => PROMOTED.includes(row.status)).length;
    const totalKilled = hypotheses.filter((row) => KILLED.includes(row.status)).length;
    const totalDecided = totalPromoted + totalKilled;
    const totals = {
        total: hypotheses.length,
        decided: totalDecided,
        promoted: totalPromoted,
        killed: totalKilled,
        open: hypotheses.filter((row) => OPEN.includes(row.status)).length,
        promoteRate: rate(totalPromoted, totalDecided),
        killRate: rate(totalKilled, totalDecided),
        untagged,
        classesTracked: classes.length
    };
    for (const row of classes) {
        if (row.verdict === "over-invested") {
            signals.push({
                kind: "over-invested",
                heuristicFamily: row.heuristicFamily,
                detail: row.advice,
                evidence: `${row.decided} decided, ${row.promoted} promoted, ${row.killed} killed`
            });
        }
        if (row.promoteRateDelta !== null &&
            row.promoteRateDelta <= -promoteCollapseDelta &&
            row.recentWindow.decided >= 2) {
            signals.push({
                kind: "promote-collapse",
                heuristicFamily: row.heuristicFamily,
                detail: "Creation-order window promote rate fell well below the lifetime rate. Confirm this is real decline and not reordering before treating it as drift.",
                evidence: `lifetime ${row.promoteRate} vs recent ${row.recentWindow.promoteRate} across ${row.recentWindow.decided} recent decisions`
            });
        }
        if (row.priorId &&
            row.verdict === "productive" &&
            row.difficulty === "inference-dependent" &&
            row.decided >= minDecidedForVerdict) {
            signals.push({
                kind: "inference-dependent-success",
                heuristicFamily: row.heuristicFamily,
                detail: "An inference-dependent class produced promotions here. Record which oracle made it decidable; that oracle is reusable knowledge for other classes.",
                evidence: `${row.promoted} promotions from ${row.decided} decisions on ${row.priorId}`
            });
        }
    }
    if (untagged > 0) {
        signals.push({
            kind: "untagged-hypotheses",
            heuristicFamily: null,
            detail: "Hypotheses recorded without a class tag cannot be calibrated. Set heuristicFamily to a class prior id, or to a planner surface family, when recording.",
            evidence: `${untagged} of ${hypotheses.length} hypotheses untagged`
        });
    }
    if (unmappedFamilies.length > 0) {
        signals.push({
            kind: "unmapped-family",
            heuristicFamily: null,
            detail: "Some heuristic families match no class prior. Either the taxonomy drifted or a prior is missing from the catalog.",
            evidence: unmappedFamilies.join(", ")
        });
    }
    return {
        generatedAt: new Date().toISOString(),
        caveat: exports.CALIBRATION_CAVEAT,
        decisionTaxonomy: { promoted: PROMOTED, killed: KILLED, open: OPEN },
        thresholds: {
            minDecidedForVerdict,
            productivePromoteRate,
            recentWindowSize,
            promoteCollapseDelta
        },
        totals: {
            ...totals,
            promoteRate: totals.promoteRate === null ? null : round4(totals.promoteRate),
            killRate: totals.killRate === null ? null : round4(totals.killRate)
        },
        classes,
        signals,
        unmappedFamilies,
        difficulties: class_playbooks_1.CLASS_DIFFICULTY_TIERS
    };
}
/** One-line rollup suitable for a checkpoint or a campaign resume. */
function renderCalibrationDigest(report) {
    if (report.totals.total === 0) {
        return "Calibration: no hypotheses recorded yet, so effectiveness is unknown.";
    }
    const lines = [
        `Calibration: ${report.totals.total} hypotheses, ${report.totals.decided} decided, promote rate ${report.totals.promoteRate === null ? "n/a" : report.totals.promoteRate}.`
    ];
    for (const row of report.classes.slice(0, 6)) {
        lines.push(`- ${row.heuristicFamily}: ${row.verdict} (${row.promoted}/${row.decided} promoted${row.priorId ? `, prior ${row.priorId}` : ""})`);
    }
    for (const signal of report.signals.slice(0, 6)) {
        lines.push(`- signal ${signal.kind}: ${signal.evidence}`);
    }
    return lines.join("\n");
}
