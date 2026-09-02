/* eslint-disable @typescript-eslint/no-require-imports -- Jest loads custom environments as CommonJS. */
const { TestEnvironment } = require("jest-environment-node");
const { PGlite } = require("@electric-sql/pglite");

// Load Emscripten outside Jest's CJS VM so its dynamic Node imports work
// without enabling experimental VM modules for the application's tests.
module.exports = class PGliteEnvironment extends TestEnvironment {
	async setup() {
		await super.setup();
		this.global.PGlite = PGlite;
	}
};
