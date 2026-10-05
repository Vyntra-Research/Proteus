"use strict";
/**
 * Vulnerability-class priors.
 *
 * Proteus maps architectures well but starts every campaign with no class-level
 * priors: nothing tells the coordinator that a class needing inference-based
 * confirmation behaves nothing like a class solvable by reading a sink, or that
 * runaway effort is itself a failure signal.
 *
 * These priors are deliberately advisory. The empirical anchors come from MAPTA
 * (arXiv 2508.13588 is CAI Fluency; MAPTA is "Multi-Agent Penetration Testing
 * AI for the Web", David & Gervais, UCL) measured on the 104-challenge XBOW
 * benchmark. XBOW is a CTF-style benchmark, so those rates describe agent
 * behaviour against known-injected web challenges, not real-world code review.
 * Treat every rate as directional, keep the sample size attached, and never let
 * a prior substitute for evidence about the actual target.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLASS_PRIOR_CAVEAT = exports.CLASS_DIFFICULTY_TIERS = void 0;
exports.listClassPriors = listClassPriors;
exports.getClassPrior = getClassPrior;
exports.summarizeClassPrior = summarizeClassPrior;
exports.queryClassPriors = queryClassPriors;
exports.listCoveredSurfaceFamilies = listCoveredSurfaceFamilies;
exports.listValidHeuristicTags = listValidHeuristicTags;
exports.resolveHeuristicTag = resolveHeuristicTag;
exports.describeHeuristicTag = describeHeuristicTag;
exports.renderClassPriorBriefing = renderClassPriorBriefing;
exports.CLASS_DIFFICULTY_TIERS = [
    "systematic-high-yield",
    "moderate",
    "inference-dependent"
];
exports.CLASS_PRIOR_CAVEAT = "Class priors are directional heuristics, not findings. Benchmark rates come from CTF-style " +
    "challenges and do not transfer directly to production code review. Small samples are noise. " +
    "A prior tells you where to aim and what harness to build first; it never replaces evidence " +
    "about the target, and it must never be cited as impact or as proof a class is present.";
const CLASS_PRIORS = [
    {
        id: "idor-bola",
        name: "Object-level authorization (IDOR/BOLA)",
        cwe: ["CWE-639", "CWE-862"],
        owasp: ["API1:2023 Broken Object Level Authorization", "A01:2021"],
        surfaceFamilies: ["auth-authz-session", "request-lifecycle-routing-identity"],
        difficulty: "systematic-high-yield",
        rationale: "Usually decided by one missing ownership or capability check on an otherwise ordinary endpoint, so reading the handler settles it far more often than probing does.",
        evidence: [
            {
                source: "MAPTA XBOW, broken authorization category",
                sample: "24/29 challenges",
                rate: "83% success"
            }
        ],
        requiresHarness: ["two identities of differing privilege", "an object owned by the second identity"],
        techniqueShift: "Enumerate the identifier space from the response body, then diff what identity A may read against what identity B owns. Chasing parameter tampering on a single endpoint finds horizontal bugs but misses vertical ones, and misses every object reached only through nested or indirect references.",
        sourceToSink: [
            "handler reads an identifier from the request and queries by it without an owner or tenant predicate",
            "identifier accepted from a list, filter, sort, search, or pagination cursor rather than a path segment",
            "authorization decided from a client-supplied role, tenant, or organization field",
            "child resource fetched by parent id with the parent check omitted",
            "graphQL node()/GID resolution resolving any object the caller names"
        ],
        misframings: [
            "'The endpoint is behind authentication, so it is authorized.' Authentication is not object-level authorization.",
            "'Sequential ids prove it.' Enumerable ids prove reachability, not that a foreign object is readable."
        ],
        killConditions: [
            "the identifier is not attacker-controlled and cannot be influenced transitively",
            "the response is identical and equally informative for both identities (no oracle)",
            "the object is scoped to the caller by a predicate that cannot be bypassed from outside",
            "cross-identity reads were actually attempted and returned the caller's own data only"
        ],
        negativeControls: [
            "identity A reading identity A's own object must succeed, proving the endpoint works",
            "identity A reading a nonexistent id must fail distinctly from reading a foreign id, so absence is not mistaken for authorization"
        ],
        effort: {
            band: "short",
            onStall: "If two identities and one foreign object have not been established early, build the harness before forming any hypothesis. More identifier guessing without a second identity produces no signal."
        },
        roles: ["argus", "skeptic"]
    },
    {
        id: "broken-authentication",
        name: "Authentication bypass and session handling",
        cwe: ["CWE-287", "CWE-384", "CWE-613"],
        owasp: ["A07:2021 Identification and Authentication Failures", "API2:2023"],
        surfaceFamilies: ["auth-authz-session", "callback-webhook-retry-replay"],
        difficulty: "inference-dependent",
        rationale: "The weakest measured category: bypasses live in inconsistent credential paths and token handling that rarely look wrong in the code you are reading, so they need adversarial state-machine work rather than a single check.",
        evidence: [
            {
                source: "MAPTA XBOW, broken authentication category",
                sample: "1/3 challenges",
                rate: "33% success"
            }
        ],
        requiresHarness: ["two accounts in different states (confirmed, unconfirmed, locked)", "token pair captured before and after each state transition"],
        techniqueShift: "Enumerate every distinct credential-acceptance path and every state transition, then diff them. Testing one login form repeatedly does not reach this class; the bug is in the paths that differ from the one you tested.",
        sourceToSink: [
            "alternative credential acceptance differing in normalization, case, type coercion, or trailing characters",
            "session identifier not rotated on authentication change",
            "password reset or email change step without re-authentication",
            "token accepted after expiry, revocation, or algorithm confusion",
            "recovery or support path that skips the control the primary path enforces"
        ],
        misframings: [
            "'Strong hashing implies strong authentication.' Storage strength and acceptance-path consistency are different problems.",
            "'Rate limiting is the control.' Rate limiting limits guessing; it does not create an authorization decision."
        ],
        killConditions: [
            "every credential path normalizes identically under the same comparison the product documents",
            "session identifiers demonstrably rotate on each authentication-relevant transition",
            "the only difference found requires a configuration the documentation does not support"
        ],
        negativeControls: [
            "the intended account still authenticates after the tested path, proving the harness did not break the flow",
            "a genuinely invalid credential fails on every path, so a shared failure is a harness artifact"
        ],
        effort: {
            band: "long",
            onStall: "This class is where runaway effort is most likely to be misread as promise. If the state-transition matrix has not been enumerated, stop and enumerate it; do not keep re-probing a single path."
        },
        roles: ["argus", "skeptic", "loom"]
    },
    {
        id: "sql-injection-direct",
        name: "SQL injection with observable response",
        cwe: ["CWE-89"],
        owasp: ["A03:2021 Injection", "API8:2023"],
        surfaceFamilies: ["parser-serializer-canonicalization", "request-lifecycle-routing-identity"],
        difficulty: "systematic-high-yield",
        rationale: "The canonical example of a class where reading the sink decides the outcome: whether user input reaches a query as a bound parameter or as concatenated text is visible in the code.",
        evidence: [
            {
                source: "MAPTA XBOW, SQL injection category",
                sample: "5/6 challenges",
                rate: "83% success"
            }
        ],
        requiresHarness: ["one endpoint where input provably reaches a query", "an observable difference between true and false conditions"],
        techniqueShift: "Find the query construction first and classify it: bound parameter, escaped string, numeric interpolation, or identifier interpolation. Identifier and numeric contexts defeat the escaping that makes string contexts look safe, so they are where the residual risk concentrates.",
        sourceToSink: [
            "string concatenation or interpolation into a query, including template literals and ORM raw fragments",
            "numeric or identifier field interpolated without quoting, where quote-based escaping is irrelevant",
            "dynamic ORDER BY, column, or table name selected from request input",
            "second-order injection where a stored value is later concatenated into a query",
            "query built from a JSON or array field whose elements are concatenated individually"
        ],
        misframings: [
            "'The ORM is used, so it is safe.' Raw fragments and dynamic identifiers bypass the parameterization the ORM provides.",
            "'Escaping was applied, so it is safe.' Escaping does not apply to unquoted numeric or identifier positions."
        ],
        killConditions: [
            "every attacker-reachable value is bound through the driver and never concatenated",
            "the only injectable position is not attacker-reachable",
            "database permissions demonstrably bound the operation regardless of injection"
        ],
        negativeControls: [
            "a benign quote character in a non-injectable field must not change the response, proving the probe is measuring the sink and not a generic parser",
            "true and false conditions must differ on a known-good endpoint, so a null result means absent injection rather than a dead oracle"
        ],
        effort: {
            band: "short",
            onStall: "If the query construction has not been located, payload spray is wasted. Find the sink, classify the context, then probe."
        },
        roles: ["argus", "chaos"]
    },
    {
        id: "sql-injection-blind",
        name: "Blind and time-based SQL injection",
        cwe: ["CWE-89"],
        owasp: ["A03:2021 Injection", "API8:2023"],
        surfaceFamilies: ["parser-serializer-canonicalization"],
        difficulty: "inference-dependent",
        rationale: "The only measured category with zero success: there is no response oracle, so success depends on building a statistically sound inference procedure rather than on trying more payloads.",
        evidence: [
            {
                source: "MAPTA XBOW, blind SQL injection category",
                sample: "0/3 challenges",
                rate: "0% success"
            }
        ],
        requiresHarness: [
            "a repeatable boolean or timing oracle",
            "a baseline measurement of normal latency to separate signal from network noise",
            "multiple samples per condition so a threshold can be justified"
        ],
        techniqueShift: "This class is not solved by better payloads; it is solved by inference discipline. Establish a negative control, take repeated samples, require a separation threshold you can defend, and confirm with a second independent predicate before believing any extracted value. Also check for cheaper oracles first: a difference in row count, ordering, or a secondary error message often removes the need for timing entirely.",
        sourceToSink: [
            "boolean-controlled branch with no visible effect other than true/false behaviour",
            "time-delay primitive such as a sleep or heavy query in an injectable position",
            "second-order injection where the boolean result surfaces somewhere else entirely"
        ],
        misframings: [
            "'The response did not change, so it is not injectable.' Without an oracle, absence of visible change is expected either way.",
            "'One slow response proves time-based injection.' A single slow sample is network jitter until a baseline and repetition exist."
        ],
        killConditions: [
            "a repeatable baseline shows the candidate delay is inside normal variance",
            "true and false predicates are indistinguishable across repeated samples",
            "the injectable position is not attacker-reachable even though the query is dynamic"
        ],
        negativeControls: [
            "a false predicate must be measured repeatedly and must not separate from the baseline",
            "a known-true predicate must separate, proving the procedure can detect a difference at all"
        ],
        effort: {
            band: "long",
            onStall: "Highest stall risk of any class. If the oracle is not statistically justified, no amount of additional sampling is progress. Prefer hunting for a visible oracle elsewhere in the same query."
        },
        roles: ["chaos", "skeptic"]
    },
    {
        id: "command-injection",
        name: "Command injection and argument injection",
        cwe: ["CWE-78", "CWE-88"],
        owasp: ["A03:2021 Injection"],
        surfaceFamilies: ["plugin-tool-sandbox-execution", "request-lifecycle-routing-identity"],
        difficulty: "systematic-high-yield",
        rationale: "Directly visible at the sink: whether a request value becomes part of a command string or a process argument decides the outcome without any inference.",
        evidence: [
            {
                source: "MAPTA XBOW, command injection category",
                sample: "6/8 challenges",
                rate: "75% success"
            }
        ],
        requiresHarness: ["an out-of-band or side-effect channel to confirm execution", "a non-destructive proof command"],
        techniqueShift: "Separate shell metacharacter injection from argument injection. With a fixed binary and no shell, option smuggling is the live path, so check whether attacker input can become a flag rather than a command.",
        sourceToSink: [
            "shell invoked with a string that interpolates request data",
            "argument array where a request value occupies a leading-dash position",
            "path or filename from the request passed to a process that resolves it",
            "template or configuration value reaching a process execution path"
        ],
        misframings: [
            "'Input is escaped, so it is safe.' Escaping for one context does not carry to argument position or to a different shell.",
            "'Only a benign command ran, so there is no impact.' Impact must be demonstrated at the level being claimed."
        ],
        killConditions: [
            "the value never reaches a shell or a process argument list",
            "execution uses a fixed binary with a validated argument vector and no shell involvement",
            "the only reachable effect is a read the attacker could already perform through the documented interface"
        ],
        negativeControls: [
            "the benign command must succeed first, so a failure is not read as a blocked injection",
            "control characters must be shown inert in the same field to prove the probe is meaningful"
        ],
        effort: { band: "short", onStall: "Locate the process boundary; do not fuzz around it." },
        roles: ["argus", "artificer"]
    },
    {
        id: "ssti",
        name: "Server-side template injection",
        cwe: ["CWE-1336", "CWE-94"],
        owasp: ["A03:2021 Injection"],
        surfaceFamilies: ["parser-serializer-canonicalization", "request-lifecycle-routing-identity"],
        difficulty: "systematic-high-yield",
        rationale: "A high measured rate because template engines are self-identifying: the error output or the rendered result usually names the engine, which collapses the search space immediately.",
        evidence: [
            {
                source: "MAPTA XBOW, server-side template injection category",
                sample: "11/13 challenges",
                rate: "85% success"
            }
        ],
        requiresHarness: ["a distinguishable arithmetic or type probe to confirm evaluation"],
        techniqueShift: "Identify the engine from error text or behaviour first, then use that engine's own expression syntax. Cross-engine payload lists waste effort because the syntax, and often the escape rules, are engine-specific.",
        sourceToSink: [
            "request data concatenated into a template string rather than passed as template data",
            "user-controlled template name, source, or include path",
            "content that reaches a template compiler after a validation step that assumed data-only use"
        ],
        misframings: [
            "'The output is HTML, so it is client-side only.' Server-side rendering changes who evaluates the expression.",
            "'Escaping blocked the payload, so the sink is absent.' Confirm evaluation with a non-markup probe before concluding."
        ],
        killConditions: [
            "request data is passed only as a template variable, never as template source",
            "evaluation probe produces no evaluation effect",
            "the render path is not reachable from external input"
        ],
        negativeControls: [
            "the same probe must fail on a field confirmed not to be templated, proving the probe detects evaluation",
            "an arithmetic result must be distinguishable from literal echoed text"
        ],
        effort: { band: "short", onStall: "Engine identification resolves most of this class; do not brute-force syntax." },
        roles: ["argus", "chaos"]
    },
    {
        id: "xss",
        name: "Cross-site scripting, including DOM sinks",
        cwe: ["CWE-79", "CWE-80"],
        owasp: ["A03:2021 Injection"],
        surfaceFamilies: ["request-lifecycle-routing-identity", "parser-serializer-canonicalization"],
        difficulty: "inference-dependent",
        rationale: "Moderate and highly variable: the same markup can be inert or exploitable depending on the sink type, the encoding context, and whether a real browser executes it, so payload count is a poor predictor of success.",
        evidence: [
            {
                source: "MAPTA XBOW, cross-site scripting category",
                sample: "13/23 challenges",
                rate: "57% success"
            }
        ],
        requiresHarness: ["a real browser execution context", "a sink-type classification: HTML body, attribute, JavaScript string, URL, or DOM property"],
        techniqueShift: "Classify the sink before choosing a payload. Encoding is context-dependent, so a payload that works in an HTML body can be inert in an attribute or a JavaScript string; and DOM sinks require tracing script execution, not just the HTML response. Confirm execution in a browser, because markup presence in a response is not exploitability.",
        sourceToSink: [
            "value written into HTML without context-appropriate encoding",
            "value placed in an attribute, a JavaScript string literal, or a URL context",
            "client-side sink such as innerHTML, document.write, eval, or a framework binding to raw HTML",
            "reflected through a redirect, an error page, or a stored value re-rendered elsewhere"
        ],
        misframings: [
            "'The payload is reflected, so it is exploitable.' Reflection is not execution; the sink context decides.",
            "'The framework escapes by default.' Escaping defaults do not cover raw-HTML bindings and URL contexts."
        ],
        killConditions: [
            "the value is encoded for its exact sink context on every reachable path",
            "the sink is not reachable from attacker-controlled data",
            "no execution occurs in a real browser with the payload placed in the confirmed context"
        ],
        negativeControls: [
            "the marker must be shown inert in a non-vulnerable field to prove the encoding is doing the work",
            "execution must be observed in a browser, not inferred from response bytes, and a parser-only harness must not be treated as proof"
        ],
        effort: {
            band: "moderate",
            onStall: "Repeatedly re-encoding a payload without classifying the sink is the characteristic stall. Stop, classify the context, then re-probe."
        },
        roles: ["argus", "chaos", "skeptic"]
    },
    {
        id: "ssrf",
        name: "Server-side request forgery",
        cwe: ["CWE-918"],
        owasp: ["A10:2021 SSRF", "API7:2023"],
        surfaceFamilies: ["url-path-host-origin", "runtime-adapter-environment-divergence"],
        difficulty: "systematic-high-yield",
        rationale: "Perfect in the measured benchmark because reachability of the request plus an address outside the allowlist is directly observable, without needing an inference oracle.",
        evidence: [
            {
                source: "MAPTA XBOW, server-side request forgery category",
                sample: "3/3 challenges",
                rate: "100% success"
            }
        ],
        requiresHarness: ["an attacker-observable channel proving the outbound request happened"],
        techniqueShift: "Establish the readback first. Proof that a request left the server is not proof of confidentiality impact, so name the specific reachable asset and show the response or side effect. Then test the allowlist logic directly, including redirect following and alternate schemes, since those are where the residual bypasses live.",
        sourceToSink: [
            "request value used as a URL host, port, or path by an outbound fetch",
            "URL fetched after a redirect without revalidating the destination",
            "scheme or parser ambiguity letting a disallowed target reach an allowed one",
            "internal address reachable because validation compares against a hostname string rather than the resolved address"
        ],
        misframings: [
            "'A canary callback proves data disclosure.' It proves reachability only; confidentiality needs a read.",
            "'The blocklist covers it.' Blocklists are the weakest form and are usually bypassable by alternate representation."
        ],
        killConditions: [
            "the destination is validated against the resolved address after redirects and scheme normalization",
            "internal ranges are unreachable from the server's own position",
            "no attacker-controlled component reaches the fetch"
        ],
        negativeControls: [
            "a reserved non-routable address as a control must fail, proving the probe distinguishes reachable from unreachable",
            "a legitimate allowed destination must still succeed, proving the harness did not simply break egress"
        ],
        effort: { band: "short", onStall: "Build the readback channel before testing impact claims." },
        roles: ["argus", "mimic"]
    },
    {
        id: "path-traversal",
        name: "Path traversal and namespace escape",
        cwe: ["CWE-22", "CWE-23"],
        owasp: ["A01:2021 Broken Access Control", "API1:2023"],
        surfaceFamilies: ["url-path-host-origin", "auth-authz-session"],
        difficulty: "systematic-high-yield",
        rationale: "The decision lives in one normalization step, so the sink and the canonicalization are both readable, and the historical weak spot is a mismatch between what validation normalizes and what the filesystem consumes.",
        evidence: [
            {
                source: "MAPTA XBOW, grouped under broken authorization",
                sample: "within 24/29 challenges",
                rate: "grouped, not separately reported"
            }
        ],
        requiresHarness: ["two files where one is outside the intended directory but harmless to reference"],
        techniqueShift: "Find every step between request and filesystem call, then check each one independently. The exploitable gap is where validation resolves the path one way and the open call resolves it another, including encoding applied after validation and symlinks inside the base directory.",
        sourceToSink: [
            "path joined from request data without resolving and rebasing",
            "validation performed on the raw string while the open call operates on a decoded or normalized form",
            "archive extraction writing entries whose names contain parent references",
            "identifier used to build a path in a shared or user-writable directory"
        ],
        misframings: [
            "'The string does not contain dot-dot, so it is blocked.' The check and the consumer may disagree on encoding.",
            "'It is only a read of a public file.' Prove the escape itself first, then scope the impact."
        ],
        killConditions: [
            "the resolved path is proven to stay within the base directory after the same normalization the filesystem applies",
            "symlinks cannot be introduced into the base directory by an untrusted actor",
            "the traversal characters never reach a path-building call"
        ],
        negativeControls: [
            "a legitimate nested path must still resolve, proving the harness works",
            "a harmless in-base file must be readable, so a failure indicates the block and not a broken harness"
        ],
        effort: { band: "short", onStall: "Trace normalization steps rather than adding encodings." },
        roles: ["argus", "chaos"]
    },
    {
        id: "misconfiguration-exposed-admin",
        name: "Exposed administrative or debug surface",
        cwe: ["CWE-284", "CWE-16"],
        owasp: ["A05:2021 Security Misconfiguration"],
        surfaceFamilies: ["request-lifecycle-routing-identity", "runtime-adapter-environment-divergence"],
        difficulty: "systematic-high-yield",
        rationale: "High yield and cheap to check, but frequently a non-finding: most exposed surfaces are documented, intentionally public, or protected, so the work is proving reachability and then proving real impact.",
        evidence: [
            {
                source: "MAPTA XBOW, misconfiguration category",
                sample: "3/3 challenges",
                rate: "100% success"
            }
        ],
        requiresHarness: ["an unauthenticated request context", "the product documentation, to establish intended exposure"],
        techniqueShift: "Reachability is the easy half and is where most reports die. For each exposed surface, establish whether the project intends it to be public, then whether the exposed capability crosses a security boundary. An endpoint that is public by design and read-only within existing authority is a non-finding regardless of how interesting it looks.",
        sourceToSink: [
            "debug, metrics, health, or profiling endpoint reachable without authentication",
            "administrative interface or default credentials on a shipped component",
            "verbose error output disclosing stack traces, internal paths, or secrets",
            "management interface bound more broadly than the documented deployment"
        ],
        misframings: [
            "'It is exposed, therefore it is a vulnerability.' Exposure must be unintended and must cross a boundary.",
            "'It returns a lot of data, therefore it is sensitive.' Establish what the data is and who may see it."
        ],
        killConditions: [
            "the surface is documented as intentionally public",
            "the exposed capability stays inside the caller's existing authority",
            "the content is public information or non-sensitive diagnostics"
        ],
        negativeControls: [
            "an authenticated request to the same surface must succeed, so a rejection proves the control and not a broken harness",
            "verify against the product's own documentation before calling exposure unintended"
        ],
        effort: { band: "short", onStall: "If intent is unclear, stop and resolve intent before writing impact language." },
        roles: ["mimic", "libris", "skeptic"]
    },
    {
        id: "deserialization",
        name: "Unsafe deserialization and gadget reachability",
        cwe: ["CWE-502"],
        owasp: ["A08:2021 Software and Data Integrity Failures"],
        surfaceFamilies: ["parser-serializer-canonicalization", "runtime-adapter-environment-divergence"],
        difficulty: "inference-dependent",
        rationale: "Not measured in the benchmark, and structurally harder than it looks: reaching a deserializer is common, but impact requires a reachable gadget chain, which is a separate and much harder proof.",
        evidence: [
            {
                source: "no benchmark rate available",
                sample: "not measured",
                rate: "unknown; do not assume reachability implies impact"
            }
        ],
        requiresHarness: ["identification of the concrete serializer format", "a gadget inventory reachable from the classes the format can instantiate"],
        techniqueShift: "Split the claim in two and prove both separately: untrusted data reaches a deserializer, and a dangerous gadget is reachable from it. The first is usually easy and frequently reported alone, which is why so many of these are disputed. Do not treat deserialization as impact; treat it as a precondition.",
        sourceToSink: [
            "serialized object graph decoded from request, cookie, header, cache, or stored field",
            "format allowing arbitrary class instantiation rather than a fixed data schema",
            "signed or encrypted token whose signature covers integrity but not type safety",
            "deserialization performed by library code far from the request handler"
        ],
        misframings: [
            "'Deserialization equals RCE.' It equals a precondition; the chain decides impact.",
            "'The data is signed, so it is safe.' Signing establishes provenance, not type safety of the decoded graph."
        ],
        killConditions: [
            "the format is a fixed schema with no class instantiation",
            "no dangerous gadget is reachable from the instantiable set",
            "the decode path is not reachable from attacker-controlled bytes"
        ],
        negativeControls: [
            "a well-formed benign payload must decode successfully, proving the path is live",
            "a payload that instantiates a known-harmless class must show no side effect, establishing the baseline"
        ],
        effort: {
            band: "long",
            onStall: "This class attracts the most speculative work. If the gadget inventory has not been built, a payload spray proves nothing. Build the inventory or close the branch as precondition-only."
        },
        roles: ["argus", "chaos", "skeptic"]
    },
    {
        id: "business-logic",
        name: "Business logic and workflow abuse",
        cwe: ["CWE-840"],
        owasp: ["A04:2021 Insecure Design"],
        surfaceFamilies: ["cache-state-authority", "callback-webhook-retry-replay", "auth-authz-session"],
        difficulty: "inference-dependent",
        rationale: "Defeats signature-based detection by construction, since there is no dangerous pattern to match; the bug is a missing rule in the workflow, so it is found by reasoning about intended behaviour rather than by probing.",
        evidence: [
            {
                source: "MAPTA XBOW, insecure design category",
                sample: "7 challenges in the benchmark",
                rate: "not separately broken out"
            }
        ],
        requiresHarness: ["a written statement of the intended business rule", "an identity pair able to exercise the workflow state machine"],
        techniqueShift: "Write down the rule the product claims before testing anything, then look for the state transition that violates it. Reordering, skipping, repeating, or racing a step is usually the whole bug, so the hunt is over the state machine's edges rather than over parameter values.",
        sourceToSink: [
            "multi-step workflow where a later step does not verify an earlier step completed",
            "price, quantity, discount, or entitlement supplied by the client",
            "state transition reachable out of order or more than once",
            "authorization checked per request but not per state entry, allowing a cheaper path to a premium state"
        ],
        misframings: [
            "'The API enforces it on the normal path.' The finding is the path that does not.",
            "'It needs many users to matter.' Show it with the fewest identities and steps that still work."
        ],
        killConditions: [
            "every state transition independently validates the prerequisite it depends on",
            "server-side recomputation overrides client-supplied values",
            "the workflow cannot be entered or completed out of order"
        ],
        negativeControls: [
            "the intended sequence must succeed, so failure is not mistaken for a missing feature",
            "a second identity without the prerequisite must be blocked, proving the rule exists somewhere"
        ],
        effort: {
            band: "moderate",
            onStall: "Without a written rule, exploration produces anecdotes. Stop and derive the intended rule from documentation or code comments first."
        },
        roles: ["loom", "argus", "skeptic"]
    },
    {
        id: "race-condition",
        name: "Race conditions and time-of-check to time-of-use",
        cwe: ["CWE-362", "CWE-367"],
        owasp: ["A04:2021 Insecure Design"],
        surfaceFamilies: ["cache-state-authority", "plugin-tool-sandbox-execution"],
        difficulty: "inference-dependent",
        rationale: "Cannot be established by reading alone and does not reproduce sequentially at all; it needs a concurrency harness, so most of the work is engineering the harness rather than finding the flaw.",
        evidence: [
            {
                source: "no benchmark rate available",
                sample: "not measured",
                rate: "unknown; nondeterministic by nature"
            }
        ],
        requiresHarness: ["a repeatable concurrent trigger", "an invariant that must hold and a way to observe its violation"],
        techniqueShift: "Name the invariant and the window first, then widen or narrow the window deliberately. A race that appears once in a thousand attempts is a harness result worth keeping only if the invariant violation is captured as evidence; otherwise it is noise.",
        sourceToSink: [
            "check and use separated across an await, a queue, or a transaction boundary",
            "read-modify-write on shared state without locking or compare-and-set",
            "limit, balance, or quota enforced by a value read before the decrementing write",
            "single-use token or nonce checked without atomic consumption"
        ],
        misframings: [
            "'It did not reproduce, so it is not a race.' Nondeterminism is expected; absence of a reproduction is not evidence of absence.",
            "'It reproduced once, so it is confirmed.' Confirm the invariant violation, not the symptom."
        ],
        killConditions: [
            "the check and the use are atomic in the same transaction or under a lock",
            "the invariant holds under repeated concurrent triggering",
            "no attacker-relevant window exists between the two operations"
        ],
        negativeControls: [
            "sequential execution must always respect the invariant, proving the invariant is the thing being tested",
            "a single-threaded control run must show no violation, so concurrency is the variable"
        ],
        effort: {
            band: "long",
            onStall: "Without a captured invariant violation, additional attempts generate anecdotes rather than evidence. Fix the harness or close the branch."
        },
        roles: ["chaos", "cicada"]
    },
    {
        id: "crypto-weakness",
        name: "Cryptographic weakness",
        cwe: ["CWE-327", "CWE-330", "CWE-347"],
        owasp: ["A02:2021 Cryptographic Failures"],
        surfaceFamilies: ["auth-authz-session", "callback-webhook-retry-replay"],
        difficulty: "moderate",
        rationale: "Mechanical to detect once the construction is read, but very easy to over-report: the finding is the construction in a realistic context, not the use of a standard algorithm.",
        evidence: [
            {
                source: "MAPTA XBOW, cryptographic category",
                sample: "1/1 challenge",
                rate: "100% success on a single challenge; far too small a sample to generalize"
            }
        ],
        requiresHarness: ["the actual construction as used, including mode and parameter choices"],
        techniqueShift: "Read the construction, not the library name. A modern primitive in a broken mode, or a comparison that is not constant time, is the realistic finding; naming an outdated algorithm without a reachable attack is not.",
        sourceToSink: [
            "ECB mode or fixed initialization vector where ciphertext patterns leak",
            "static or reused nonce or initialization vector",
            "integrity check computed with a non-cryptographic comparison",
            "signature verified with an algorithm chosen by the attacker or with the key used as the verification key",
            "password hashing with a fast general-purpose digest instead of a dedicated function"
        ],
        misframings: [
            "'The algorithm is old, therefore it is broken.' Age alone is not a reachable attack.",
            "'It is encrypted, therefore it is protected.' Unauthenticated encryption permits undetected tampering."
        ],
        killConditions: [
            "the construction is sound for its actual use, and no reachable attack applies",
            "the data protected is public or non-sensitive",
            "the concern requires a threat model the product does not claim"
        ],
        negativeControls: [
            "confirm the protected value is genuinely sensitive before asserting confidentiality impact",
            "confirm integrity is actually relied upon, since unauthenticated encryption may be irrelevant here"
        ],
        effort: { band: "short", onStall: "If the construction is sound, close it; do not escalate severity by assertion." },
        roles: ["argus", "skeptic"]
    },
    {
        id: "vulnerable-component",
        name: "Vulnerable or mismatched dependency",
        cwe: ["CWE-1104"],
        owasp: ["A06:2021 Vulnerable and Outdated Components"],
        surfaceFamilies: ["runtime-adapter-environment-divergence", "plugin-tool-sandbox-execution"],
        difficulty: "moderate",
        rationale: "Mostly determined by external intel rather than by code reading, so the deciding work is version identification and reachability, and the most common failure is a version claim that is never proven.",
        evidence: [
            {
                source: "MAPTA XBOW, vulnerable component category",
                sample: "3 challenges in the benchmark",
                rate: "not separately broken out"
            }
        ],
        requiresHarness: ["a proven installed version, not a declared range", "evidence that the vulnerable code path is reachable in this deployment"],
        techniqueShift: "Prove the version first, from the artifact actually deployed, then prove reachability of the affected function. An advisory match on a declared range is a hypothesis; without both, it is a duplicate waiting to happen or a false positive.",
        sourceToSink: [
            "manifest declares a range while the built artifact resolves to a different version",
            "affected function reachable from external input in this configuration",
            "transitive dependency carrying the vulnerable code without a direct reference",
            "vendored copy of a dependency whose version no longer matches upstream"
        ],
        misframings: [
            "'The lockfile shows a vulnerable version.' The lockfile shows intent; the artifact shows reality.",
            "'The advisory matches, so it is reportable.' Root cause, reachability, and deployment must still line up."
        ],
        killConditions: [
            "the deployed version is outside the affected range, proven from the artifact",
            "the affected code path is not reachable in this deployment",
            "the fix is present through a patched fork carrying the same change"
        ],
        negativeControls: [
            "version evidence must come from the shipped artifact, not from a manifest",
            "confirm the vulnerable function is actually called before reporting"
        ],
        effort: {
            band: "short",
            onStall: "If the deployed version cannot be established from the artifact, the branch cannot advance. Go get that evidence instead of trying more paths."
        },
        roles: ["libris", "argus"]
    }
];
function normalize(value) {
    return (value ?? "").trim().toLowerCase();
}
function matchesText(prior, needle) {
    if (!needle)
        return true;
    const haystack = [
        prior.id,
        prior.name,
        ...prior.cwe,
        ...prior.owasp,
        ...prior.surfaceFamilies,
        prior.rationale,
        prior.techniqueShift,
        ...prior.sourceToSink,
        ...prior.misframings,
        ...prior.killConditions,
        ...prior.negativeControls
    ]
        .join(" ")
        .toLowerCase();
    return haystack.includes(needle);
}
function listClassPriors() {
    return CLASS_PRIORS.map((prior) => ({ ...prior }));
}
function getClassPrior(id) {
    const needle = normalize(id);
    const found = CLASS_PRIORS.find((prior) => normalize(prior.id) === needle);
    if (!found) {
        throw new Error(`Unknown class prior: ${id}. Known priors: ${CLASS_PRIORS.map((prior) => prior.id).join(", ")}`);
    }
    return { ...found };
}
function summarizeClassPrior(prior) {
    return {
        id: prior.id,
        name: prior.name,
        cwe: prior.cwe,
        owasp: prior.owasp,
        surfaceFamilies: prior.surfaceFamilies,
        difficulty: prior.difficulty,
        rationale: prior.rationale,
        evidence: prior.evidence
            .map((item) => `${item.source} — ${item.sample}${item.rate ? `, ${item.rate}` : ""}`)
            .join("; ")
    };
}
function matchClassPriors(input) {
    const idNeedle = normalize(input.id);
    const familyNeedle = normalize(input.family);
    const textNeedle = normalize(input.text);
    return CLASS_PRIORS.filter((prior) => {
        if (idNeedle && normalize(prior.id) !== idNeedle)
            return false;
        if (familyNeedle && !prior.surfaceFamilies.some((family) => normalize(family) === familyNeedle)) {
            return false;
        }
        if (input.difficulty && prior.difficulty !== input.difficulty)
            return false;
        if (textNeedle && !matchesText(prior, textNeedle))
            return false;
        return true;
    });
}
function queryClassPriors(input = {}) {
    const detail = input.detail ?? "full";
    const matched = matchClassPriors(input);
    return {
        caveat: exports.CLASS_PRIOR_CAVEAT,
        detail,
        matched: matched.map((prior) => (detail === "summary" ? summarizeClassPrior(prior) : { ...prior })),
        difficulties: [...new Set(CLASS_PRIORS.map((prior) => prior.difficulty))],
        families: [...new Set(CLASS_PRIORS.flatMap((prior) => prior.surfaceFamilies))].sort()
    };
}
const UNTAGGED_LABELS = new Set(["", "unknown", "n/a", "na", "none", "unspecified", "tbd"]);
/** Every planner surface family covered by at least one class prior. */
function listCoveredSurfaceFamilies() {
    return [...new Set(listClassPriors().flatMap((prior) => prior.surfaceFamilies))].sort();
}
/** Prior ids and covered surface families, for self-correcting callers. */
function listValidHeuristicTags() {
    return {
        priorIds: listClassPriors().map((prior) => prior.id),
        surfaceFamilies: listCoveredSurfaceFamilies()
    };
}
function resolveHeuristicTag(tag) {
    const label = (tag ?? "").trim();
    const needle = label.toLowerCase();
    const catalog = listClassPriors();
    if (UNTAGGED_LABELS.has(needle))
        return { kind: "untagged", label: label || "unknown" };
    const exact = catalog.find((prior) => prior.id.toLowerCase() === needle);
    if (exact) {
        return {
            kind: "prior",
            label,
            priorId: exact.id,
            priorName: exact.name,
            difficulty: exact.difficulty
        };
    }
    const byIdFragment = catalog.filter((prior) => prior.id.toLowerCase().includes(needle) || needle.includes(prior.id.toLowerCase()));
    if (byIdFragment.length === 1) {
        const prior = byIdFragment[0];
        return { kind: "prior", label, priorId: prior.id, priorName: prior.name, difficulty: prior.difficulty };
    }
    if (byIdFragment.length > 1) {
        return { kind: "ambiguous", label, candidates: byIdFragment.map((prior) => prior.id) };
    }
    const byName = catalog.filter((prior) => prior.name.toLowerCase().includes(needle) || needle.includes(prior.name.toLowerCase()));
    if (byName.length === 1) {
        const prior = byName[0];
        return { kind: "prior", label, priorId: prior.id, priorName: prior.name, difficulty: prior.difficulty };
    }
    if (byName.length > 1) {
        return { kind: "ambiguous", label, candidates: byName.map((prior) => prior.id) };
    }
    const surfaceFamilies = listCoveredSurfaceFamilies();
    const matchedFamily = surfaceFamilies.find((family) => family.toLowerCase() === needle);
    if (matchedFamily) {
        return {
            kind: "surface-family",
            label,
            family: matchedFamily,
            priorIds: catalog
                .filter((prior) => prior.surfaceFamilies.includes(matchedFamily))
                .map((prior) => prior.id)
        };
    }
    return { kind: "unmapped", label };
}
function describeHeuristicTag(resolution) {
    const valid = listValidHeuristicTags();
    switch (resolution.kind) {
        case "prior":
            return `heuristicFamily "${resolution.label}" resolved to class prior ${resolution.priorId} (${resolution.difficulty}). Calibration will track this class.`;
        case "surface-family":
            return `heuristicFamily "${resolution.label}" is the planner surface family ${resolution.family}, covered by ${resolution.priorIds.length} class priors. Calibration groups by the family rather than a single class.`;
        case "ambiguous":
            return `heuristicFamily "${resolution.label}" is ambiguous and matches ${resolution.candidates.join(", ")}. Narrow it to one class prior id.`;
        case "untagged":
            return `heuristicFamily "${resolution.label}" is untagged, so this hypothesis cannot be calibrated. Set it to a class prior id such as ${valid.priorIds.slice(0, 3).join(", ")}, or to a covered surface family.`;
        default:
            return `heuristicFamily "${resolution.label}" matches no class prior or covered surface family. Use a class prior id such as ${valid.priorIds.slice(0, 3).join(", ")}, or a covered surface family such as ${valid.surfaceFamilies.slice(0, 2).join(", ")}.`;
    }
}
/** One-line rollup suitable for prompt injection. Keeps the caveat attached to the numbers. */
function renderClassPriorBriefing(input) {
    const matched = matchClassPriors(input);
    if (matched.length === 0) {
        return `No class prior matched ${JSON.stringify(input)}. Priors are optional; continue from the surface map.`;
    }
    const lines = [];
    for (const prior of matched) {
        lines.push(`## ${prior.name} (${prior.id})`);
        lines.push(`Difficulty tier: ${prior.difficulty}. ${prior.rationale}`);
        lines.push(`Evidence: ${prior.evidence
            .map((item) => `${item.source} — ${item.sample}${item.rate ? `, ${item.rate}` : ""}`)
            .join("; ")}`);
        if (prior.requiresHarness.length > 0) {
            lines.push(`Build before hypothesizing: ${prior.requiresHarness.join("; ")}.`);
        }
        lines.push(`Technique shift: ${prior.techniqueShift}`);
        lines.push(`Source-to-sink heuristics: ${prior.sourceToSink.join("; ")}.`);
        if (prior.misframings.length > 0) {
            lines.push(`Misframings to drop early: ${prior.misframings.join(" ")}`);
        }
        lines.push(`Kill conditions: ${prior.killConditions.join("; ")}.`);
        lines.push(`Negative controls: ${prior.negativeControls.join("; ")}.`);
        lines.push(`Effort prior: ${prior.effort.band}. ${prior.effort.onStall}`);
        lines.push("");
    }
    lines.push(exports.CLASS_PRIOR_CAVEAT);
    return lines.join("\n");
}
