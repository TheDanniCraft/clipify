import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { packBrowserBuild, unpackBrowserBuild } from "./browser-build-artifact.mjs";

test("the shared browser artifact preserves runtime, manifests and maps without compilation caches", () => {
	const root = mkdtempSync(join(tmpdir(), "browser artifact "));
	const source = join(root, "build"),
		restored = join(root, "restored"),
		archive = join(root, "runtime.tar.gz");
	const files = { BUILD_ID: "current-build", "server/app.js": "runtime", "server/app.js.map": "source-map", "static/chunk.js": "static", "required-server-files.json": "{}", "cache/webpack/big.pack": "build-only", "standalone/server.js": "unused-standalone" };
	try {
		for (const [path, content] of Object.entries(files)) {
			mkdirSync(dirname(join(source, path)), { recursive: true });
			writeFileSync(join(source, path), content);
		}
		assert.ok(packBrowserBuild(source, archive) > 0);
		unpackBrowserBuild(archive, restored);
		for (const [path, content] of Object.entries(files).filter(([path]) => !path.startsWith("cache/") && !path.startsWith("standalone/"))) assert.equal(readFileSync(join(restored, path), "utf8"), content);
		assert.equal(existsSync(join(restored, "cache")), false);
		assert.equal(existsSync(join(restored, "standalone")), false);
		assert.throws(() => packBrowserBuild(root, archive), /Incomplete browser build/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
