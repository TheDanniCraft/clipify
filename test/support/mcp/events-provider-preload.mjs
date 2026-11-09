// Provider-only transport fixture. Application OAuth, database, storage validation and browser UI remain real.
import { randomUUID } from "node:crypto";
import { browserDatabaseUrl } from "./browser-database.cjs";
browserDatabaseUrl();
const nativeFetch = globalThis.fetch.bind(globalThis);
const files = new Map();
globalThis.fetch = async (input, init) => {
	const url = new URL(input instanceof Request ? input.url : String(input));
	if (url.origin !== "https://www.googleapis.com" || !/^\/(?:upload\/)?drive\/v3\/files(?:\/|$)/.test(url.pathname)) return nativeFetch(input, init);
	const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
	if (headers.get("Authorization") !== "Bearer isolated-event-drive-token") return nativeFetch(input, init);
	const method = init?.method ?? "GET";
	if (url.pathname === "/drive/v3/files" && method === "POST") {
		const metadata = JSON.parse(String(init.body));
		const id = randomUUID();
		files.set(id, { mime: metadata.mimeType, bytes: new Uint8Array() });
		return Response.json({ id });
	}
	const id = url.pathname.split("/").at(-1);
	const file = files.get(id);
	if (!file) return Response.json({ error: "missing" }, { status: 404 });
	if (method === "DELETE") {
		files.delete(id);
		return new Response(null, { status: 204 });
	}
	if (url.pathname.startsWith("/upload/") && method === "PATCH") return new Response(null, { status: 200, headers: { Location: `https://www.googleapis.com/upload/drive/v3/files/${id}?upload_id=isolated-session` } });
	if (url.pathname.startsWith("/upload/") && method === "PUT") {
		file.bytes = new Uint8Array(await new Response(init.body).arrayBuffer());
		return Response.json({ id, size: String(file.bytes.length), mimeType: file.mime });
	}
	if (method === "GET" && url.searchParams.get("alt") === "media") return new Response(file.bytes, { headers: { "Content-Type": file.mime, "Content-Length": String(file.bytes.length) } });
	throw new Error("Unsupported event provider fixture request");
};
