import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { ClipifySdkError, createClipifyClient } from "@clipify/sdk";

export function searchArguments(args) {
	if (args[0] !== "search") throw new Error("INVALID_ARGUMENTS");
	const input = {};
	for (let i = 1; i < args.length; i += 2) {
		if (!args[i + 1]) throw new Error("INVALID_ARGUMENTS");
		if (args[i] === "--title" && input.title === undefined && args[i + 1].length <= 200) input.title = args[i + 1];
		else if (args[i] === "--limit" && input.limit === undefined && /^\d{1,3}$/.test(args[i + 1]) && Number(args[i + 1]) >= 1 && Number(args[i + 1]) <= 100) input.limit = Number(args[i + 1]);
		else throw new Error("INVALID_ARGUMENTS");
	}
	return input;
}
async function secret(env, name) {
	if (!env[name]) throw new Error("MISSING_CONFIGURATION");
	try {
		const value = (await readFile(env[name], "utf8")).trim();
		if (!value || value.length > 4096 || /[\r\n]/.test(value)) throw new Error();
		return value;
	} catch {
		throw new Error("MISSING_CONFIGURATION");
	}
}
export async function search(args, env = process.env) {
	const input = searchArguments(args);
	if (!env.CLIPIFY_BASE_URL || !env.CLIPIFY_CREATOR_ID) throw new Error("MISSING_CONFIGURATION");
	const [clientId, clientSecret, password] = await Promise.all([secret(env, "CLIPIFY_CLIENT_ID_FILE"), secret(env, "CLIPIFY_CLIENT_SECRET_FILE"), secret(env, "AWARDS_DATABASE_PASSWORD_FILE")]);
	const sdk = createClipifyClient({ baseUrl: env.CLIPIFY_BASE_URL, clientId, clientSecret, allowInsecureHttp: env.CLIPIFY_ALLOW_INSECURE_HTTP === "true" });
	const pool = new pg.Pool({ host: env.AWARDS_DATABASE_HOST ?? "awards-db", database: "awards", user: "awards", password, connectionTimeoutMillis: 5000, statement_timeout: 5000, max: 1 });
	try {
		await pool.query("SELECT 1");
	} catch {
		throw new Error("AWARDS_DATABASE_UNAVAILABLE");
	} finally {
		await pool.end();
	}
	return sdk.clips.search({ creatorId: env.CLIPIFY_CREATOR_ID, ...(input.title === undefined ? {} : { filters: { title: input.title } }), ...(input.limit === undefined ? {} : { limit: input.limit }) });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		process.stdout.write(`${JSON.stringify(await search(process.argv.slice(2)))}\n`);
	} catch (error) {
		const localCodes = new Set(["INVALID_ARGUMENTS", "MISSING_CONFIGURATION", "AWARDS_DATABASE_UNAVAILABLE"]);
		const code = error instanceof ClipifySdkError ? error.code : localCodes.has(error?.message) ? error.message : "SERVICE_UNAVAILABLE";
		process.stderr.write(`${JSON.stringify({ ok: false, error: { code } })}\n`);
		process.exitCode = 1;
	}
}
