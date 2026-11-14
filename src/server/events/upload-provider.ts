import "server-only";
import type { eventConnectionsTable } from "@/db/schema";
import { eventGoogleToken, eventS3Credentials } from "./connections";
import { s3Request } from "./storage-http";
import { guardUploadBody } from "./upload-policy";
import { EventError } from "./persistence";
import { requestProviderJson, readProviderResponseJson } from "@/server/runner/provider-api";
type Connection = typeof eventConnectionsTable.$inferSelect;
const fileId = (key: string) => {
	if (!/^[A-Za-z0-9_-]{1,200}$/.test(key)) throw new EventError("INVALID_INPUT");
	return key;
};
async function driveToken(connection: Connection) {
	const token = await eventGoogleToken(connection.ownerId, "drive");
	if (token.connection.id !== connection.id) throw new EventError("STORAGE_REQUIRED");
	return token.accessToken;
}
export async function allocateAwardUpload(connection: Connection, assetId: string, mime: string, signal: AbortSignal) {
	if (connection.provider === "s3") {
		const configuration = eventS3Credentials(connection);
		return `${configuration.prefix ? `${configuration.prefix}/` : ""}${assetId}`;
	}
	if (connection.provider !== "drive") throw new EventError("STORAGE_REQUIRED");
	const token = await driveToken(connection);
	const data = (await requestProviderJson("https://www.googleapis.com/drive/v3/files?fields=id", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: assetId, mimeType: mime, parents: [connection.identityId] }), signal })) as { id?: unknown };
	if (typeof data.id !== "string") throw new EventError("PROVIDER_UNAVAILABLE");
	return fileId(data.id);
}
export async function writeAwardUpload(connection: Connection, key: string, input: { mime: string; size: number }, body: ReadableStream<Uint8Array>, signal: AbortSignal) {
	const guarded = guardUploadBody(body, input.size, input.mime);
	if (connection.provider === "s3") {
		const credentials = eventS3Credentials(connection);
		const response = await s3Request(credentials, "PUT", key, { headers: new Headers({ "Content-Type": input.mime, "Content-Length": String(input.size) }), body: guarded, signal });
		await response.body?.cancel();
		if (!response.ok) throw new EventError("PROVIDER_UNAVAILABLE");
		const verify = await s3Request(credentials, "HEAD", key, { signal });
		if (!verify.ok || Number(verify.headers.get("Content-Length")) !== input.size || verify.headers.get("Content-Type")?.split(";")[0] !== input.mime) throw new EventError("PROVIDER_UNAVAILABLE");
		return;
	}
	if (connection.provider !== "drive") throw new EventError("STORAGE_REQUIRED");
	const token = await driveToken(connection),
		id = fileId(key);
	const timeout = AbortSignal.any([signal, AbortSignal.timeout(120000)]);
	const started = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=resumable&fields=id,size,mimeType`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Upload-Content-Type": input.mime, "X-Upload-Content-Length": String(input.size) }, body: "{}", signal: timeout, redirect: "error", cache: "no-store" });
	const location = started.headers.get("Location");
	await started.body?.cancel();
	if (!started.ok || !location) throw new EventError("PROVIDER_UNAVAILABLE");
	let destination: URL;
	try {
		destination = new URL(location);
	} catch {
		throw new EventError("PROVIDER_UNAVAILABLE");
	}
	if (destination.origin !== "https://www.googleapis.com" || destination.username || destination.password || destination.hash || !destination.pathname.startsWith("/upload/drive/v3/files/")) throw new EventError("PROVIDER_UNAVAILABLE");
	const options: RequestInit & { duplex: "half" } = { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": input.mime, "Content-Length": String(input.size) }, body: guarded, duplex: "half", signal: timeout, redirect: "error", cache: "no-store" };
	const completed = await fetch(destination.toString(), options);
	if (!completed.ok) {
		await completed.body?.cancel();
		throw new EventError("PROVIDER_UNAVAILABLE");
	}
	const metadata = (await readProviderResponseJson(completed)) as { id?: unknown; size?: unknown; mimeType?: unknown };
	if (metadata.id !== id || Number(metadata.size) !== input.size || metadata.mimeType !== input.mime) throw new EventError("PROVIDER_UNAVAILABLE");
}
export async function deleteAwardUpload(connection: Connection, key: string) {
	if (connection.provider === "s3") {
		const response = await s3Request(eventS3Credentials(connection), "DELETE", key, { signal: AbortSignal.timeout(10000) });
		await response.body?.cancel();
		if (!response.ok) throw new EventError("PROVIDER_UNAVAILABLE");
		return;
	}
	if (connection.provider !== "drive") throw new EventError("STORAGE_REQUIRED");
	const token = await driveToken(connection);
	await requestProviderJson(`https://www.googleapis.com/drive/v3/files/${fileId(key)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }, [404]);
}
export async function readAwardUpload(connection: Connection, key: string, range: string | null, signal: AbortSignal) {
	const headers = new Headers();
	if (range) {
		if (!/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) throw new EventError("INVALID_INPUT");
		headers.set("Range", range);
	}
	if (connection.provider === "s3") return s3Request(eventS3Credentials(connection), "GET", key, { headers, signal });
	if (connection.provider !== "drive") throw new EventError("STORAGE_REQUIRED");
	headers.set("Authorization", `Bearer ${await driveToken(connection)}`);
	return fetch(`https://www.googleapis.com/drive/v3/files/${fileId(key)}?alt=media`, { headers, signal, redirect: "error", cache: "no-store" });
}
