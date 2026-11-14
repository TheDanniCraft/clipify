// A real loopback HTTP responder stands in for Twitch only in disposable E2E.
// Session, role, provider-token lookup/decryption and admin route checks remain real.
import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import { browserDatabaseUrl } from "./browser-database.cjs";
browserDatabaseUrl();
const server = http.createServer((request, response) => {
	const fixtureUrl = new URL(request.url, "http://fixture.invalid");
	if (process.env.MCP_EVENT_CHAT_PROVIDER_FIXTURE === "true" && fixtureUrl.pathname === "/oauth2/token" && request.method === "POST" && fixtureUrl.searchParams.get("client_id") === "isolated-browser-client" && fixtureUrl.searchParams.get("client_secret") === "isolated-browser-client-secret" && fixtureUrl.searchParams.get("grant_type") === "client_credentials") {
		response.writeHead(200, { "Content-Type": "application/json" });
		response.end(JSON.stringify({ access_token: "isolated-event-app-token", expires_in: 3600, token_type: "bearer" }));
		return;
	}

	if (request.url !== "/oauth2/validate" || request.headers.authorization !== "Bearer isolated-dashboard-fixture-token") {
		response.writeHead(401, { "Content-Type": "application/json" });
		response.end('{"error":"invalid controlled fixture token"}');
		return;
	}
	response.writeHead(200, { "Content-Type": "application/json" });
	response.end(JSON.stringify({ client_id: "isolated-browser-client", scopes: ["user:read:email"], expires_in: 3600 }));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
server.unref();
const address = server.address();
const original = https.request;
https.request = function (input, options, callback) {
	const isUrl = typeof input === "string" || input instanceof URL;
	const opts = isUrl ? { ...(typeof options === "object" ? options : {}) } : input;
	const url = isUrl ? new URL(input) : new URL(`https://${opts.hostname ?? opts.host}${opts.path ?? "/"}`);
	if (url.hostname !== "id.twitch.tv" || !(url.pathname === "/oauth2/validate" || (process.env.MCP_EVENT_CHAT_PROVIDER_FIXTURE === "true" && url.pathname === "/oauth2/token"))) return original.call(this, input, options, callback);
	const done = typeof options === "function" ? options : callback;
	return http.request({ hostname: "127.0.0.1", port: address.port, path: url.pathname + url.search, method: opts.method ?? "GET", headers: opts.headers }, done);
};
syncBuiltinESMExports();
process.once("beforeExit", () => server.close());
