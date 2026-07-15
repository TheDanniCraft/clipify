import crypto from "node:crypto";
import zlib from "node:zlib";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { RUNNER_CONTEXT } from "./runnerContext.generated";

export const RUNNER_PLATFORMS = ["windows-x64", "linux-x64", "linux-arm64", "macos-x64", "macos-arm64"] as const;
export type RunnerPlatform = (typeof RUNNER_PLATFORMS)[number];

const LEGACY_BINARY_NAMES: Record<RunnerPlatform, string> = {
	"windows-x64": "clipify-runner-windows.exe",
	"linux-x64": "clipify-runner-linux",
	"linux-arm64": "clipify-runner-linux-arm64",
	"macos-x64": "clipify-runner-macos",
	"macos-arm64": "clipify-runner-macos-arm64",
};

const LEGACY_OS_KEYS: Record<RunnerPlatform, "windows" | "linux" | "linuxArm" | "macos" | "macosArm"> = {
	"windows-x64": "windows",
	"linux-x64": "linux",
	"linux-arm64": "linuxArm",
	"macos-x64": "macos",
	"macos-arm64": "macosArm",
};

export type RunnerArtifact = {
	platform: RunnerPlatform;
	target: string;
	filename: string;
	sha256: string;
	size: number;
	oci: { reference: string; digest: string };
};

export type RunnerManifest = {
	schemaVersion: 1;
	sourceFingerprint: string;
	sourceCommit: string;
	repository: string;
	artifacts: RunnerArtifact[];
};

export class RunnerArtifactUnavailableError extends Error {
	readonly code = "runner_artifact_unavailable";
	constructor(message = "Runner artifacts are not available yet") {
		super(message);
		this.name = "RunnerArtifactUnavailableError";
	}
}

const repository = (process.env.RUNNER_OCI_REPOSITORY ?? "ghcr.io/thedannicraft/clipify-runner")
	.replace(/^https?:\/\//, "")
	.replace(/\/$/, "")
	.toLowerCase();
const cacheRoot = process.env.RUNNER_CACHE_DIR ?? path.join(os.tmpdir(), "clipify-runner-cache");
const manifestPromises = new Map<string, Promise<RunnerManifest>>();
const artifactPromises = new Map<string, Promise<{ buffer: Buffer; artifact: RunnerArtifact; source: "oci" }>>();

function currentFingerprint() {
	if (!/^[0-9a-f]{64}$/.test(RUNNER_CONTEXT.sourceFingerprint)) throw new RunnerArtifactUnavailableError("This deployment has no Runner source fingerprint");
	return RUNNER_CONTEXT.sourceFingerprint;
}

function cachePath(...parts: string[]) {
	return path.join(cacheRoot, ...parts);
}

function hash(buffer: Buffer) {
	return crypto.createHash("sha256").update(buffer).digest("hex");
}

function authHeaders(): HeadersInit {
	const token = process.env.RUNNER_OCI_TOKEN;
	if (!token) return {};
	const username = process.env.RUNNER_OCI_USERNAME ?? "clipify";
	return { Authorization: `Basic ${Buffer.from(`${username}:${token}`).toString("base64")}` };
}

let bearerToken: string | undefined;
let bearerTokenPromise: Promise<string> | undefined;

function bearerChallenge(value: string | null) {
	if (!value || !/^Bearer\s/i.test(value)) return undefined;
	const parameters = Object.fromEntries([...value.matchAll(/([a-z]+)="([^"]*)"/gi)].map((match) => [match[1].toLowerCase(), match[2]]));
	if (!parameters.realm) return undefined;
	return parameters;
}

async function getBearerToken(challenge: Record<string, string>) {
	if (bearerToken) return bearerToken;
	if (!bearerTokenPromise) {
		bearerTokenPromise = (async () => {
			const tokenUrl = new URL(challenge.realm);
			if (challenge.service) tokenUrl.searchParams.set("service", challenge.service);
			if (challenge.scope) tokenUrl.searchParams.set("scope", challenge.scope);
			const response = await fetch(tokenUrl, { headers: authHeaders(), cache: "no-store" });
			if (!response.ok) throw new Error(`Runner registry token request failed: HTTP ${response.status}`);
			const body = (await response.json()) as { token?: string; access_token?: string };
			const token = body.token ?? body.access_token;
			if (!token) throw new Error("Runner registry token response did not contain a token");
			bearerToken = token;
			return token;
		})().finally(() => {
			bearerTokenPromise = undefined;
		});
	}
	return bearerTokenPromise;
}

async function registryFetch(url: string, headers: HeadersInit = {}) {
	const request = (authorization?: string) =>
		fetch(url, {
			headers: { ...headers, ...authHeaders(), ...(authorization ? { Authorization: authorization } : {}) },
			cache: "no-store",
		});

	let response = await request(bearerToken ? `Bearer ${bearerToken}` : undefined);
	if (response.status === 401) {
		const challenge = bearerChallenge(response.headers.get("www-authenticate"));
		if (challenge) {
			bearerToken = undefined;
			const token = await getBearerToken(challenge);
			response = await request(`Bearer ${token}`);
		}
	}
	return response;
}

async function registryJson(url: string) {
	const response = await registryFetch(url, {
		Accept: "application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.index.v1+json",
	});
	if (!response.ok) throw new Error(`Runner registry request failed: HTTP ${response.status}`);
	return (await response.json()) as Record<string, unknown>;
}

function tarFile(buffer: Buffer, wantedPath: string): Buffer {
	// Use the synchronous zlib API without adding a runtime dependency.
	const unpacked = buffer[0] === 0x1f && buffer[1] === 0x8b ? zlib.gunzipSync(buffer) : buffer;
	for (let offset = 0; offset + 512 <= unpacked.length;) {
		const header = unpacked.subarray(offset, offset + 512);
		if (header.every((value) => value === 0)) break;
		const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
		const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
		const fullName = prefix ? `${prefix}/${name}` : name;
		const sizeText = header.subarray(124, 136).toString("ascii").replace(/\0.*$/, "").trim();
		const size = sizeText ? parseInt(sizeText, 8) : 0;
		const dataStart = offset + 512;
		if (fullName === wantedPath) return Buffer.from(unpacked.subarray(dataStart, dataStart + size));
		offset = dataStart + Math.ceil(size / 512) * 512;
	}
	throw new Error(`OCI layer does not contain ${wantedPath}`);
}

async function fetchLayerFile(tag: string, wantedPath: string): Promise<Buffer> {
	const manifestUrl = `https://${repository}/v2/${repository.replace(/^ghcr\.io\//, "")}/manifests/${encodeURIComponent(tag)}`;
	let manifest = await registryJson(manifestUrl);
	if (Array.isArray(manifest.manifests)) {
		const selected = (manifest.manifests as Array<Record<string, unknown>>).find((entry) => {
			const platform = entry.platform as Record<string, string> | undefined;
			return platform?.os === "linux" && platform?.architecture === "amd64";
		});
		if (!selected?.digest) throw new Error(`No linux/amd64 OCI manifest found for ${tag}`);
		manifest = await registryJson(`https://${repository}/v2/${repository.replace(/^ghcr\.io\//, "")}/manifests/${selected.digest}`);
	}
	const layers = manifest.layers as Array<Record<string, string>> | undefined;
	const layer = layers?.[0];
	if (!layer?.digest) throw new Error(`No OCI layer found for ${tag}`);
	const blobUrl = `https://${repository}/v2/${repository.replace(/^ghcr\.io\//, "")}/blobs/${layer.digest}`;
	const response = await registryFetch(blobUrl);
	if (!response.ok) throw new Error(`Runner blob request failed: HTTP ${response.status}`);
	return tarFile(Buffer.from(await response.arrayBuffer()), wantedPath);
}

function validateManifest(value: unknown, fingerprint: string): RunnerManifest {
	const manifest = value as Partial<RunnerManifest>;
	if (manifest.schemaVersion !== 1 || manifest.sourceFingerprint !== fingerprint || manifest.repository !== repository || !Array.isArray(manifest.artifacts)) throw new Error("Invalid Runner manifest");
	const artifacts = manifest.artifacts as RunnerArtifact[];
	if (artifacts.length !== RUNNER_PLATFORMS.length || new Set(artifacts.map((artifact) => artifact.platform)).size !== artifacts.length) throw new Error("Incomplete Runner manifest");
	for (const platform of RUNNER_PLATFORMS) {
		const artifact = artifacts.find((entry) => entry.platform === platform);
		if (!artifact || !/^[0-9a-f]{64}$/.test(artifact.sha256) || !/^sha256:[0-9a-f]{64}$/.test(artifact.oci?.digest ?? "") || artifact.oci.reference !== `${repository}:fp-${fingerprint}-${platform}`) throw new Error(`Invalid Runner artifact entry for ${platform}`);
	}
	return manifest as RunnerManifest;
}

async function readCachedManifest(fingerprint: string) {
	try {
		return validateManifest(JSON.parse(await fsp.readFile(cachePath(`manifest-${fingerprint}.json`), "utf8")), fingerprint);
	} catch {
		return undefined;
	}
}

export async function getRunnerManifest(): Promise<RunnerManifest> {
	const fingerprint = currentFingerprint();
	const cached = await readCachedManifest(fingerprint);
	if (cached) return cached;
	const existing = manifestPromises.get(fingerprint);
	if (existing) return existing;
	const promise = (async () => {
		try {
			const raw = await fetchLayerFile(`fp-${fingerprint}-manifest`, "manifest.json");
			const manifest = validateManifest(JSON.parse(raw.toString("utf8")), fingerprint);
			await fsp.mkdir(cacheRoot, { recursive: true });
			await fsp.writeFile(`${cachePath(`manifest-${fingerprint}.json`)}.part`, `${JSON.stringify(manifest, null, 2)}\n`);
			await fsp.rename(`${cachePath(`manifest-${fingerprint}.json`)}.part`, cachePath(`manifest-${fingerprint}.json`));
			return manifest;
		} catch (error) {
			const fallback = await readCachedManifest(fingerprint);
			if (fallback) return fallback;
			throw new RunnerArtifactUnavailableError(error instanceof Error ? error.message : "Runner manifest unavailable");
		}
	})();
	manifestPromises.set(fingerprint, promise);
	try {
		return await promise;
	} finally {
		manifestPromises.delete(fingerprint);
	}
}

async function withFileLock(lockPath: string, callback: () => Promise<void>) {
	await fsp.mkdir(path.dirname(lockPath), { recursive: true });
	for (;;) {
		try {
			const handle = await fsp.open(lockPath, "wx");
			await handle.close();
			break;
		} catch {
			try {
				if (Date.now() - (await fsp.stat(lockPath)).mtimeMs > 300_000) await fsp.unlink(lockPath);
			} catch {
				// The lock disappeared between stat and unlink.
			}
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}
	try {
		await callback();
	} finally {
		await fsp.unlink(lockPath).catch(() => undefined);
	}
}

export async function getRunnerArtifact(platform: RunnerPlatform) {
	const fingerprint = currentFingerprint();
	const key = `${fingerprint}:${platform}`;
	const existing = artifactPromises.get(key);
	if (existing) return existing;
	const promise = (async () => {
		const manifest = await getRunnerManifest();
		const artifact = manifest.artifacts.find((entry) => entry.platform === platform);
		if (!artifact) throw new RunnerArtifactUnavailableError(`Runner artifact missing for ${platform}`);
		const destination = cachePath(fingerprint, artifact.filename);
		const cached = await fsp.readFile(destination).catch(() => undefined);
		if (cached && hash(cached) === artifact.sha256) return { buffer: cached, artifact, source: "oci" as const };
		try {
			let result: Buffer | undefined;
			await withFileLock(`${destination}.lock`, async () => {
				const lockedCached = await fsp.readFile(destination).catch(() => undefined);
				if (lockedCached && hash(lockedCached) === artifact.sha256) {
					result = lockedCached;
					return;
				}
				result = await fetchLayerFile(`fp-${fingerprint}-${platform}`, `runner/${artifact.filename}`);
				if (hash(result) !== artifact.sha256) throw new Error(`Runner artifact hash mismatch for ${platform}`);
				await fsp.mkdir(path.dirname(destination), { recursive: true });
				await fsp.writeFile(`${destination}.part`, result);
				await fsp.rename(`${destination}.part`, destination);
			});
			return { buffer: result!, artifact, source: "oci" as const };
		} catch (error) {
			throw error;
		}
	})();
	artifactPromises.set(key, promise);
	try {
		return await promise;
	} finally {
		artifactPromises.delete(key);
	}
}

export function platformForLegacyOs(os: string): RunnerPlatform | undefined {
	return (Object.entries(LEGACY_OS_KEYS).find(([, key]) => key === os)?.[0] as RunnerPlatform | undefined) ?? undefined;
}

export function platformForBinaryName(filename: string): RunnerPlatform | undefined {
	return (Object.entries(LEGACY_BINARY_NAMES).find(([, name]) => name === filename)?.[0] as RunnerPlatform | undefined) ?? undefined;
}

export function legacyVersionKey(platform: RunnerPlatform) {
	return LEGACY_OS_KEYS[platform];
}

export function legacyBinaryName(platform: RunnerPlatform) {
	return LEGACY_BINARY_NAMES[platform];
}

export type RunnerVersionInfo = {
	sourceFingerprint: string;
	sourceCommit: string;
	repository: string;
	windows: string | null;
	linux: string | null;
	linuxArm: string | null;
	macos: string | null;
	macosArm: string | null;
	updatedAt: string | null;
	artifacts?: RunnerArtifact[];
};

export async function getRunnerVersionInfo(): Promise<RunnerVersionInfo | null> {
	try {
		const manifest = await getRunnerManifest();
		const byPlatform = (platform: RunnerPlatform) => manifest.artifacts.find((artifact) => artifact.platform === platform)?.sha256 ?? null;
		return {
			sourceFingerprint: manifest.sourceFingerprint,
			sourceCommit: manifest.sourceCommit,
			repository: manifest.repository,
			windows: byPlatform("windows-x64"),
			linux: byPlatform("linux-x64"),
			linuxArm: byPlatform("linux-arm64"),
			macos: byPlatform("macos-x64"),
			macosArm: byPlatform("macos-arm64"),
			updatedAt: null,
			artifacts: manifest.artifacts,
		};
	} catch {
		return null;
	}
}

export function getRunnerContext() {
	return RUNNER_CONTEXT;
}
