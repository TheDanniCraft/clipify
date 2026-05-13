import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const serverDir = path.join(root, ".next", "server");

function collectFiles(dir, files = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) collectFiles(full, files);
		else files.push(full);
	}
	return files;
}

function isActionManifest(filePath) {
	const lower = filePath.toLowerCase().replace(/\\/g, "/");
	return lower.endsWith(".json") && lower.includes("manifest") && (lower.includes("action") || lower.includes("server-reference"));
}

if (!fs.existsSync(serverDir)) {
	console.error(`Missing Next server build output at: ${serverDir}`);
	process.exit(1);
}

const candidateFiles = collectFiles(serverDir).filter(isActionManifest);
if (candidateFiles.length === 0) {
	console.error("No server action manifest files found under .next/server.");
	process.exit(1);
}

const forbiddenPatterns = ["/src/server/", "@/server/"];
const violations = [];

for (const file of candidateFiles) {
	const text = fs.readFileSync(file, "utf8");
	const normalized = text.replace(/\\/g, "/");
	for (const pattern of forbiddenPatterns) {
		if (normalized.includes(pattern)) {
			violations.push({ file, pattern });
		}
	}
}

if (violations.length > 0) {
	console.error("Server action manifest leaked internal server module references:");
	for (const v of violations) {
		console.error(`- ${v.file} matched ${v.pattern}`);
	}
	process.exit(1);
}

console.log(`Server action manifest check passed across ${candidateFiles.length} files.`);
