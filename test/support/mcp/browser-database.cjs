"use strict";
// This helper is shared by the CommonJS Jest configuration and native Node preload.
/* eslint-disable @typescript-eslint/no-require-imports */

function browserDatabaseUrl(environment = process.env) {
	if (environment.APP_ENV !== "test" || environment.E2E_TEST_MODE !== "true") {
		throw new Error("MCP browser fixtures require test and E2E mode");
	}
	let url;
	try {
		url = new URL(environment.MCP_BROWSER_DATABASE_URL ?? environment.DATABASE_URL);
	} catch {
		throw new Error("MCP browser fixtures require an explicit disposable database URL");
	}
	if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.search || url.hash) {
		throw new Error("MCP browser fixtures require a disposable loopback PostgreSQL database");
	}
	const disposable = /^\/mcp_[a-f0-9]{32}$/.test(url.pathname);
	const guardedCi = environment.CI === "true" && environment.CLIPIFY_E2E_SCHEMA_PUSH === "1" && url.pathname === "/clipify_e2e" && decodeURIComponent(url.username) === "clipify_e2e";
	if (!disposable && !guardedCi) throw new Error("MCP browser fixtures reject persistent databases");
	return url.toString();
}

function browserProviderEnvironment(environment = process.env, nodeOptions = "") {
	if (environment.MCP_BROWSER_PROVIDER_FIXTURE !== "true") return {};
	const databaseUrl = browserDatabaseUrl({ ...environment, APP_ENV: "test", E2E_TEST_MODE: "true" });
	const { pathToFileURL } = require("node:url");
	const { join } = require("node:path");
	return {
		DATABASE_URL: databaseUrl,
		MCP_BROWSER_DATABASE_URL: databaseUrl,
		MCP_ENABLED: "true",
		BETTER_AUTH_SECRET: "clipify-e2e-better-auth-secret-not-for-production",
		RATE_LIMIT_HASH_SECRET: "clipify-e2e-rate-limit-secret-not-for-production",
		TWITCH_CLIENT_ID: "isolated-browser-client",
		TWITCH_CLIENT_SECRET: "isolated-browser-client-secret",
		NODE_OPTIONS: `${nodeOptions} --import=${pathToFileURL(join(__dirname, "browser-provider-preload.mjs")).href}`.trim(),
	};
}

module.exports = { browserDatabaseUrl, browserProviderEnvironment };
