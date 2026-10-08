/* eslint-disable @typescript-eslint/no-require-imports */
const { createHash } = require("node:crypto");
const { join, resolve } = require("node:path");

/** A completed suite may consume only its own child-process coverage files. */
function suiteCoverageDirectory(root, testPath) {
	return typeof testPath === "string" && testPath.length ? join(root, createHash("sha256").update(resolve(testPath)).digest("hex")) : root;
}
module.exports = { suiteCoverageDirectory };
