import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Generated evidence and disposable databases are not execution inputs. Git's
// ignore rules also exclude dependency installs, compiled output and reports.
const roots = ["src", "test", "scripts", "packages/runner", ".github", "patches", "public", "docs", "package.json", "bun.lock", "jest.config.cjs", "jest.setup.ts", "next.config.ts", "tsconfig.json", "drizzle.config.ts", "playwright.config.ts", "playwright.mcp.config.ts"];

export function coverageSourceFingerprint(root = process.cwd()) {
	const paths = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...roots], { cwd: root, encoding: "utf8" })
		.split("\0")
		.filter(Boolean);
	const hash = createHash("sha256");
	hash.update(JSON.stringify({ node: process.version, platform: process.platform, architecture: process.arch }) + "\0");
	for (const path of [...new Set(paths)].sort()) {
		const absolute = resolve(root, path);
		if (!existsSync(absolute)) continue;
		const bytes = readFileSync(absolute);
		hash.update(`${path}\0${bytes.length}\0`);
		hash.update(bytes);
	}
	return hash.digest("hex");
}
