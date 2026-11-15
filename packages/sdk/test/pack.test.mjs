import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, chmod, utimes, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const pack = fileURLToPath(new URL("../pack.py", import.meta.url));
function members(compressed) {
	const tar = gunzipSync(compressed);
	const entries = [];
	for (let offset = 0; tar[offset];) {
		const name = tar
			.subarray(offset, offset + 100)
			.toString()
			.replace(/\0.*$/s, "");
		const mode = parseInt(tar.subarray(offset + 100, offset + 108).toString(), 8);
		const size = parseInt(tar.subarray(offset + 124, offset + 136).toString(), 8);
		entries.push({ name, mode });
		offset += 512 + Math.ceil(size / 512) * 512;
	}
	return entries;
}
test("SDK package bytes are reproducible and contain only the public release files", async () => {
	const dir = await mkdtemp(join(tmpdir(), "clipify-sdk-package-"));
	try {
		const source = join(dir, "sdk");
		await mkdir(join(source, "dist"), { recursive: true });
		for (const name of ["README.md", "package.json", "dist/index.js", "dist/index.d.ts"]) await writeFile(join(source, name), `public file ${name}\n`);
		await writeFile(join(source, ".env"), "SECRET_MUST_NEVER_BE_PACKAGED");
		const first = join(dir, "first.tgz"),
			second = join(dir, "second.tgz");
		execFileSync("python3", [pack, source, first]);
		await utimes(join(source, "dist/index.js"), new Date(0), new Date(0));
		await chmod(join(source, "README.md"), 0o777);
		execFileSync("python3", [pack, source, second]);
		const bytes = await readFile(first);
		assert.deepEqual(bytes, await readFile(second));
		assert.deepEqual(
			members(bytes),
			["README.md", "dist/index.d.ts", "dist/index.js", "package.json"].map((name) => ({ name: `package/${name}`, mode: 0o644 })),
		);
		assert.equal(gunzipSync(bytes).includes("SECRET_MUST_NEVER_BE_PACKAGED"), false);
		await writeFile(join(source, "dist/index.js"), "new public implementation\n");
		execFileSync("python3", [pack, source, second]);
		assert.notDeepEqual(bytes, await readFile(second));
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
