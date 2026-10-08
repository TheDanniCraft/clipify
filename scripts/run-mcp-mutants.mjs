import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const root = process.cwd();
const artifact = resolve(root, "test-results/mcp/mutants");
mkdirSync(artifact, { recursive: true });
const isolated = mkdtempSync(join(tmpdir(), "clipify-mcp-mutants-"));
const redact = (value) => value.replace(/Bearer eyJ[^\s]+/g, "Bearer [REDACTED_ISOLATED_TEST_TOKEN]").replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_ISOLATED_TEST_TOKEN]");
const digest = (value) => createHash("sha256").update(value).digest("hex");
const cases = [
	{ id: "omitted-scope", file: "src/auth/authorize-operation.ts", edits: [['if (!principal.scopes?.includes(input.permission)) return { allowed: false, code: "PERMISSION_DENIED" };', ""]], suite: "test/mcp/integration/creator-read-pilot.test.ts", pattern: "OAuth owner cannot escape", native: false, assertion: "PERMISSION_DENIED" },
	{ id: "wrong-owner", file: "src/server/resources/overlay-reads.ts", edits: [["and(eq(overlaysTable.id, overlayId), options.creatorId ? eq(overlaysTable.ownerId, options.creatorId) : undefined)", "eq(overlaysTable.id, overlayId)"]], suite: "test/mcp/integration/resource-operations-get-overlay.test.ts", pattern: "TDD-US2-004.*foreign resource", native: true, assertion: "RESOURCE_UNAVAILABLE" },
	{ id: "missing-online-grant", file: "src/auth/mcp-principal.ts", edits: [["!grant?.active || grant.revokedAt || grant.expiresAt <= now", "!grant"]], suite: "test/mcp/contract/oauth.test.ts", pattern: "revoking one real client", native: true, assertion: "revokedAccess" },
	{
		id: "unlocked-quota",
		file: "src/server/resources/mutation.ts",
		edits: [
			['from(creatorAccountsTable).where(eq(creatorAccountsTable.creatorId, creatorId)).limit(1).for("update")', "from(creatorAccountsTable).where(eq(creatorAccountsTable.creatorId, creatorId)).limit(1)"],
			['from(usersTable).where(eq(usersTable.id, creatorId)).limit(1).for("update")', "from(usersTable).where(eq(usersTable.id, creatorId)).limit(1)"],
		],
		suite: "test/mcp/integration/creation-quotas.test.ts",
		pattern: "20 independent session/OAuth creates share one Free owner quota",
		native: true,
		assertion: "successes",
	},
	{ id: "skipped-revision", file: "src/server/resources/revisions.ts", edits: [[" || current !== expected", ""]], suite: "test/mcp/integration/resource-operations-update-overlay.test.ts", pattern: "TDD-US2-006.*stale update fails", native: true, assertion: "CONFLICT" },
];
const sources = new Map(cases.map((item) => [item.file, readFileSync(resolve(root, item.file), "utf8")]));
const report = { sourceHashes: Object.fromEntries([...sources].map(([file, value]) => [file, digest(value)])), method: "One actual source invariant removed in an isolated copy; baseline, expected assertion failure, byte-identical restoration and Green per case", cases: [] };
function run(item, phase) {
	const args = ["jest", item.suite, "--runInBand", "--testNamePattern", item.pattern];
	const result = spawnSync("bunx", args, { cwd: isolated, encoding: "utf8", env: { ...process.env, MCP_PROBE_RUNTIME: "node" }, timeout: 180000, maxBuffer: 16 * 1024 * 1024 });
	const output = redact((result.stdout ?? "") + (result.stderr ?? "") + (result.error ? String(result.error) : ""));
	const name = `${item.id}-${phase}.txt`;
	writeFileSync(join(artifact, name), output);
	const summary = output.match(/^Tests:\s*(.*)$/m)?.[1] ?? "";
	const executed = [...summary.matchAll(/(\d+) (?:passed|failed)/g)].reduce((total, match) => total + Number(match[1]), 0);
	const noTests = /No tests found/.test(output) || executed === 0;
	if (result.error || noTests) throw new Error(`${item.id}:${phase}:execution or discovery failure; see ${name}`);
	return { status: result.status, output, name };
}
try {
	for (const directory of ["src", "test", "scripts"]) cpSync(resolve(root, directory), join(isolated, directory), { recursive: true });
	for (const file of ["package.json", "bun.lock", "tsconfig.json", "next.config.ts", "jest.config.cjs", "jest.setup.ts", "postcss.config.mjs", "drizzle.config.ts"]) if (existsSync(resolve(root, file))) cpSync(resolve(root, file), join(isolated, file));
	symlinkSync(resolve(root, "node_modules"), join(isolated, "node_modules"), "dir");
	for (const item of cases) {
		const original = sources.get(item.file);
		const target = join(isolated, item.file);
		const baseline = run(item, "baseline");
		if (baseline.status !== 0) throw new Error(`${item.id}:baseline failed`);
		let mutant = original;
		for (const [before, after] of item.edits) {
			const count = mutant.split(before).length - 1;
			if (count !== 1) throw new Error(`${item.id}:expected exactly one target, found ${count}`);
			mutant = mutant.replace(before, after);
		}
		writeFileSync(target, mutant);
		writeFileSync(join(artifact, item.id + "-patch.json"), JSON.stringify({ file: item.file, originalSha256: digest(original), mutantSha256: digest(mutant), edits: item.edits }, null, 2) + "\n");
		try {
			const red = run(item, "mutant");
			if (red.status === 0) throw new Error(`${item.id}:mutant survived`);
			if (!red.output.includes(item.assertion) || !/expect\(|Expected:|Expected value:/.test(red.output)) throw new Error(`${item.id}:failure did not establish expected assertion`);
			writeFileSync(target, original);
			if (digest(readFileSync(target, "utf8")) !== digest(original)) throw new Error(`${item.id}:restoration mismatch`);
			const green = run(item, "restored");
			if (green.status !== 0) throw new Error(`${item.id}:restored checks failed`);
			report.cases.push({ id: item.id, scope: item.native ? "actual Node/provider/PostgreSQL entry" : "shared backend scope pilot with otherwise authorized owner", suite: item.suite, pattern: item.pattern, status: "Killed and restored Green", evidence: [baseline.name, red.name, green.name] });
			writeFileSync(join(artifact, "report.json"), JSON.stringify(report, null, 2) + "\n");
			console.log(item.id + ": expected failure and restored Green");
		} finally {
			writeFileSync(target, original);
		}
	}
	for (const [file, value] of sources) if (digest(readFileSync(resolve(root, file), "utf8")) !== digest(value)) throw new Error("Workspace source changed during immutable mutation run: " + file);
	report.workspaceSourceHashesUnchanged = true;
	writeFileSync(join(artifact, "report.json"), JSON.stringify(report, null, 2) + "\n");
	console.log(`All ${cases.length} deliberate invariant mutants killed; workspace sources unchanged.`);
} finally {
	rmSync(isolated, { recursive: true, force: true });
}
