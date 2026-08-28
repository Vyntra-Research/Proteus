"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROI_FACTOR_KEYS = exports.globalLearningInputSchema = exports.validationGateInputSchema = exports.decisionInputSchema = exports.evidenceInputSchema = exports.hypothesisInputSchema = exports.surfaceInputSchema = exports.targetContractSchema = void 0;
exports.parseRoiFactors = parseRoiFactors;
exports.targetContractSchema = {
    parse(input) {
        const value = object(input, "target contract");
        return {
            target: requiredString(value.target, "target"),
            scopeRoot: requiredString(value.scopeRoot, "scopeRoot"),
            inScope: stringArray(value.inScope),
            outOfScope: stringArray(value.outOfScope),
            existingWork: stringArray(value.existingWork),
            primaryImpactClasses: stringArray(value.primaryImpactClasses),
            hardExclusions: stringArray(value.hardExclusions),
            assumptions: stringArray(value.assumptions),
            availableTooling: stringArray(value.availableTooling),
            credentialsAvailable: optionalString(value.credentialsAvailable, "unknown"),
            continuousMode: optionalBoolean(value.continuousMode, false),
            stopOnCandidate: optionalBoolean(value.stopOnCandidate, true)
        };
    }
};
exports.surfaceInputSchema = {
    parse(input) {
        const value = object(input, "surface");
        rejectUnknownKeys(value, [
            "name", "family", "description", "files", "symbols", "entrypoints",
            "trustBoundaries", "runtimeModes", "status", "roi", "revisitCondition"
        ], "surface");
        return {
            name: requiredString(value.name, "name"),
            family: requiredString(value.family, "family"),
            description: optionalString(value.description, ""),
            files: stringArray(value.files),
            symbols: stringArray(value.symbols),
            entrypoints: stringArray(value.entrypoints),
            trustBoundaries: stringArray(value.trustBoundaries),
            runtimeModes: stringArray(value.runtimeModes),
            status: enumValue(value.status, ["unmapped", "active", "covered", "exhausted", "low_roi", "blocked", "watch"], "unmapped"),
            roi: parseRoiFactors(value.roi),
            revisitCondition: optionalString(value.revisitCondition, "")
        };
    }
};
exports.hypothesisInputSchema = {
    parse(input) {
        const value = object(input, "hypothesis");
        const surfaceId = optionalNumber(value.surfaceId);
        return {
            ...(surfaceId === undefined ? {} : { surfaceId }),
            title: requiredString(value.title, "title"),
            primitive: optionalString(value.primitive, "unknown"),
            attackerBoundary: optionalString(value.attackerBoundary, "unknown"),
            impactClaim: optionalString(value.impactClaim, "unknown"),
            heuristicFamily: optionalString(value.heuristicFamily, "unknown"),
            status: enumValue(value.status, ["live", "candidate", "watchlist", "discarded", "promoted_to_poc", "report_grade"], "live"),
            score: clampNumber(value.score, 0, 100, 0),
            duplicateRisk: clampNumber(value.duplicateRisk, 0, 10, 5),
            expectedBehaviorRisk: clampNumber(value.expectedBehaviorRisk, 0, 10, 5),
            validationCost: clampNumber(value.validationCost, 0, 10, 5),
            killCriteria: optionalString(value.killCriteria, ""),
            revisitCondition: optionalString(value.revisitCondition, "")
        };
    }
};
exports.evidenceInputSchema = {
    parse(input) {
        const value = object(input, "evidence");
        return {
            kind: requiredString(value.kind, "kind"),
            title: requiredString(value.title, "title"),
            body: optionalString(value.body, ""),
            pathOrUrl: optionalMaybeString(value.pathOrUrl),
            command: optionalMaybeString(value.command)
        };
    }
};
exports.decisionInputSchema = {
    parse(input) {
        const value = object(input, "decision");
        return {
            entityType: requiredString(value.entityType, "entityType"),
            entityId: requiredNumber(value.entityId, "entityId"),
            decision: requiredString(value.decision, "decision"),
            reason: requiredString(value.reason, "reason"),
            evidenceIds: numberArray(value.evidenceIds),
            actor: optionalString(value.actor, "coordinator")
        };
    }
};
exports.validationGateInputSchema = {
    parse(input) {
        const value = object(input, "validation gate");
        return {
            entityType: requiredString(value.entityType, "entityType"),
            entityId: requiredNumber(value.entityId, "entityId"),
            gate: requiredString(value.gate, "gate"),
            status: enumValue(value.status, ["pending", "pass", "fail", "blocked", "not_applicable"], "pending"),
            summary: optionalString(value.summary, ""),
            evidenceIds: numberArray(value.evidenceIds),
            actor: optionalString(value.actor, "coordinator")
        };
    }
};
exports.globalLearningInputSchema = {
    parse(input) {
        const value = object(input, "global learning");
        return {
            category: enumValue(value.category, [
                "user_preference",
                "research_heuristic",
                "validation_pattern",
                "anti_pattern",
                "targeting_strategy",
                "tooling_note",
                "playbook_material"
            ], "research_heuristic"),
            scope: optionalString(value.scope, "global"),
            title: requiredString(value.title, "title"),
            body: optionalString(value.body, ""),
            tags: stringArray(value.tags),
            sourceTarget: optionalMaybeString(value.sourceTarget),
            confidence: clampNumber(value.confidence, 0, 1, 0.7)
        };
    }
};
exports.ROI_FACTOR_KEYS = [
    "impactPotential",
    "externalReachability",
    "trustBoundaryDensity",
    "recentChangeWeight",
    "unexploredInvariantWeight",
    "toolingReadiness",
    "duplicateRisk",
    "expectedBehaviorLikelihood",
    "priorExhaustionWeight",
    "validationCost",
    "lowSignalHistory"
];
function parseRoiFactors(input) {
    if (input === undefined || input === null)
        return zeroRoi();
    const value = object(input, "roi");
    rejectUnknownKeys(value, exports.ROI_FACTOR_KEYS, "roi");
    return {
        impactPotential: roiNumber(value.impactPotential, "impactPotential"),
        externalReachability: roiNumber(value.externalReachability, "externalReachability"),
        trustBoundaryDensity: roiNumber(value.trustBoundaryDensity, "trustBoundaryDensity"),
        recentChangeWeight: roiNumber(value.recentChangeWeight, "recentChangeWeight"),
        unexploredInvariantWeight: roiNumber(value.unexploredInvariantWeight, "unexploredInvariantWeight"),
        toolingReadiness: roiNumber(value.toolingReadiness, "toolingReadiness"),
        duplicateRisk: roiNumber(value.duplicateRisk, "duplicateRisk"),
        expectedBehaviorLikelihood: roiNumber(value.expectedBehaviorLikelihood, "expectedBehaviorLikelihood"),
        priorExhaustionWeight: roiNumber(value.priorExhaustionWeight, "priorExhaustionWeight"),
        validationCost: roiNumber(value.validationCost, "validationCost"),
        lowSignalHistory: roiNumber(value.lowSignalHistory, "lowSignalHistory")
    };
}
function zeroRoi() {
    return Object.fromEntries(exports.ROI_FACTOR_KEYS.map((key) => [key, 0]));
}
function roiNumber(input, name) {
    if (input === undefined)
        return 0;
    if (typeof input !== "number" || !Number.isFinite(input) || input < 0 || input > 10) {
        throw new Error(`Invalid roi.${name}: expected a number from 0 to 10`);
    }
    return input;
}
function object(input, name) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error(`Invalid ${name}: expected object`);
    }
    return input;
}
function rejectUnknownKeys(value, allowed, name) {
    const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
    if (unknown.length > 0)
        throw new Error(`Invalid ${name}: unsupported field(s): ${unknown.join(", ")}`);
}
function requiredString(input, name) {
    if (typeof input !== "string" || input.length === 0)
        throw new Error(`Missing ${name}`);
    return input;
}
function optionalString(input, fallback) {
    return typeof input === "string" ? input : fallback;
}
function optionalMaybeString(input) {
    return typeof input === "string" ? input : undefined;
}
function optionalBoolean(input, fallback) {
    return typeof input === "boolean" ? input : fallback;
}
function requiredNumber(input, name) {
    if (typeof input !== "number" || !Number.isFinite(input))
        throw new Error(`Missing numeric ${name}`);
    return input;
}
function optionalNumber(input) {
    return typeof input === "number" && Number.isFinite(input) ? input : undefined;
}
function clampNumber(input, min, max, fallback) {
    const value = optionalNumber(input) ?? fallback;
    return Math.max(min, Math.min(max, value));
}
function stringArray(input) {
    return Array.isArray(input) ? input.filter((item) => typeof item === "string") : [];
}
function numberArray(input) {
    const values = Array.isArray(input) ? input : typeof input === "string" ? input.split(",") : [];
    return values
        .map((item) => {
        if (typeof item === "number")
            return item;
        if (typeof item === "string" && item.trim().length > 0)
            return Number(item.trim());
        return NaN;
    })
        .filter((item) => Number.isFinite(item) && item > 0);
}
function enumValue(input, allowed, fallback) {
    if (input === undefined || input === null)
        return fallback;
    if (typeof input === "string" && allowed.includes(input))
        return input;
    throw new Error(`Invalid enum value: expected one of ${allowed.join(", ")}`);
}
