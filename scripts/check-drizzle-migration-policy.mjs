import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const generatedMigrationPatterns = [/^drizzle\/[0-9]{4}_.+\.sql$/, /^drizzle\/meta\/[0-9]{4}_snapshot\.json$/, /^drizzle\/meta\/_journal\.json$/];

export function isProtectedMigrationArtifact(file) {
	const normalized = file.trim().replaceAll("\\", "/");
	return generatedMigrationPatterns.some((pattern) => pattern.test(normalized));
}

export function hasMigrationApproval(environment = process.env) {
	const automatedMasterGeneration = environment.GITHUB_ACTIONS === "true" && environment.GITHUB_REF === "refs/heads/master" && environment.CLIPIFY_MIGRATION_WORKFLOW === "true";
	const explicitHumanApproval = ["1", "true"].includes(String(environment.CLIPIFY_MANUAL_MIGRATION_APPROVED).toLowerCase());
	return automatedMasterGeneration || explicitHumanApproval;
}

export function migrationPolicyViolations(files, environment = process.env) {
	if (hasMigrationApproval(environment)) return [];
	return files.map((file) => file.trim()).filter(isProtectedMigrationArtifact);
}

function gitChangedFiles(args) {
	const output = execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMR", ...args, "--", "drizzle"], {
		encoding: "utf8",
	});
	return output.split(/\r?\n/u).filter(Boolean);
}

function reject(action, files = []) {
	const details = files.length > 0 ? `\n\nBlocked files:\n${files.map((file) => `- ${file}`).join("\n")}` : "";
	process.stderr.write(`Drizzle migration policy blocked ${action}.\n\n` + "Feature branches commit schema source changes only. The master Generate Migrations workflow creates the single ordinary migration after merge. " + "If Drizzle cannot express required behavior, obtain explicit user approval for that custom migration; agents must not enable the override themselves." + details + "\n");
	process.exitCode = 1;
}

export function runMigrationPolicy(argv = process.argv.slice(2), environment = process.env) {
	const [mode] = argv;
	if (mode === "generate") {
		if (!hasMigrationApproval(environment)) reject("local migration generation");
		return;
	}

	let files;
	if (mode === "staged") files = gitChangedFiles(["--cached"]);
	else throw new Error("Usage: check-drizzle-migration-policy.mjs generate|staged");

	const violations = migrationPolicyViolations(files, environment);
	if (violations.length > 0) reject("generated migration artifacts", violations);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	runMigrationPolicy();
}
