import "server-only";
import { createHash, createHmac } from "node:crypto";
import { BlockList, isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { Readable } from "node:stream";
import { z } from "zod";

const blocked = new BlockList();
for (const [network, prefix] of [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.0.0.0", 24],
	["192.0.2.0", 24],
	["192.168.0.0", 16],
	["198.18.0.0", 15],
	["198.51.100.0", 24],
	["203.0.113.0", 24],
	["224.0.0.0", 3],
] as const)
	blocked.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
	["2001::", 23],
	["2001:db8::", 32],
	["2002::", 16],
	["3fff::", 20],
] as const)
	blocked.addSubnet(network, prefix, "ipv6");
const globalIpv6 = new BlockList();
globalIpv6.addSubnet("2000::", 3, "ipv6");
export function isSafeStorageAddress(address: string) {
	const family = isIP(address);
	return family === 4 ? !blocked.check(address, "ipv4") : family === 6 && globalIpv6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}
export const storageEndpointSchema = z.url().refine((value) => {
	const url = new URL(value);
	return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && url.pathname === "/";
}, "Use the HTTPS root URL of your S3 endpoint.");
export const s3CredentialsSchema = z
	.object({
		endpoint: storageEndpointSchema,
		region: z.string().regex(/^[A-Za-z0-9-]{1,80}$/),
		bucket: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
		accessKeyId: z.string().min(1).max(256),
		secretAccessKey: z.string().min(1).max(512),
		prefix: z
			.string()
			.regex(/^[A-Za-z0-9/_-]{0,200}$/)
			.default("clipify-events"),
	})
	.strict();
export type S3Credentials = z.infer<typeof s3CredentialsSchema>;
type SigningCredentials = Pick<S3Credentials, "endpoint" | "region" | "accessKeyId" | "secretAccessKey">;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const hmac = (key: Buffer | string, value: string) => createHmac("sha256", key).update(value).digest();
export function signS3Request(credentials: SigningCredentials, method: string, path: string, initial = new Headers(), now = new Date(), payloadHash = hash("")) {
	const url = new URL(path, credentials.endpoint);
	if (url.origin !== new URL(credentials.endpoint).origin || url.search || url.hash) throw new Error("INVALID_INPUT");
	const timestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
	const day = timestamp.slice(0, 8);
	const headers = new Headers(initial);
	headers.set("host", url.host);
	headers.set("x-amz-date", timestamp);
	headers.set("x-amz-content-sha256", payloadHash);
	const names = [...headers.keys()].sort();
	const signedHeaders = names.join(";");
	const canonicalHeaders = names.map((name) => `${name}:${headers.get(name)!.trim().replace(/\s+/g, " ")}\n`).join("");
	const canonical = [method, url.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
	const scope = `${day}/${credentials.region}/s3/aws4_request`;
	const key = hmac(hmac(hmac(hmac(`AWS4${credentials.secretAccessKey}`, day), credentials.region), "s3"), "aws4_request");
	const signature = hmac(key, `AWS4-HMAC-SHA256\n${timestamp}\n${scope}\n${hash(canonical)}`).toString("hex");
	headers.set("authorization", `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope},SignedHeaders=${signedHeaders},Signature=${signature}`);
	return { url, headers };
}
/** Resolve and pin the public address for this exact connection; ordinary fetch would allow DNS rebinding. */
export async function storageHttp(url: URL, options: { method: string; headers: Headers; body?: ReadableStream<Uint8Array>; signal?: AbortSignal }) {
	const endpoint = storageEndpointSchema.safeParse(url.origin);
	if (!endpoint.success) throw new Error("INVALID_INPUT");
	const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true });
	if (!addresses.length || addresses.some((item) => !isSafeStorageAddress(item.address))) throw new Error("INVALID_INPUT");
	const pinned = addresses[0];
	return new Promise<Response>((resolve, reject) => {
		const outgoing = request(
			url,
			{
				method: options.method,
				headers: Object.fromEntries(options.headers),
				signal: options.signal ?? AbortSignal.timeout(10000),
				lookup: (_host, opts, callback) => {
					if (typeof opts === "object" && opts.all) callback(null, [pinned]);
					else callback(null, pinned.address, pinned.family);
				},
			},
			(incoming) => {
				const headers = new Headers();
				for (const [key, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(",") : value);
				const status = incoming.statusCode ?? 502;
				resolve(new Response(status === 204 || options.method === "HEAD" ? null : (Readable.toWeb(incoming) as ReadableStream<Uint8Array>), { status, headers }));
				if (status === 204 || options.method === "HEAD") incoming.resume();
			},
		);
		outgoing.setTimeout(120000, () => outgoing.destroy(new Error("PROVIDER_UNAVAILABLE")));
		outgoing.once("error", reject);
		if (options.body) {
			const body = Readable.fromWeb(options.body as import("node:stream/web").ReadableStream<Uint8Array>);
			body.once("error", (error) => outgoing.destroy(error));
			outgoing.once("close", () => body.destroy());
			body.pipe(outgoing);
		} else outgoing.end();
	});
}
export async function s3Request(credentials: S3Credentials, method: string, key: string, options: { headers?: Headers; body?: ReadableStream<Uint8Array>; signal?: AbortSignal } = {}) {
	if (!/^[A-Za-z0-9/_-]+$/.test(key)) throw new Error("INVALID_INPUT");
	const path = `/${credentials.bucket}/${key}`;
	const signed = signS3Request(credentials, method, path, options.headers, new Date(), options.body ? "UNSIGNED-PAYLOAD" : undefined);
	return storageHttp(signed.url, { method, headers: signed.headers, body: options.body, signal: options.signal });
}
