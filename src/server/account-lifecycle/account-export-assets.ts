import { createHash } from "node:crypto";

type Asset = { sourceUrl?: string; file?: string; status: "included" | "unavailable"; reason?: string; bytes?: number; sha256?: string };
const extensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf", "text/plain": "txt", "video/mp4": "mp4", "audio/mpeg": "mp3", "application/zip": "zip" };
const avatarHosts = new Set(["static-cdn.jtvnw.net", "lh3.googleusercontent.com", "yt3.googleusercontent.com", "yt3.ggpht.com"]);
function records(value: unknown): Record<string, unknown>[] {
	return (Array.isArray(value) ? value : [value]).filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
}

export async function collectAccountArchiveAssets(documents: Record<string, Record<string, unknown>>) {
	const files: Record<string, Uint8Array> = {};
	const assets: Asset[] = [];
	const downloads = new Map<string, Asset>();
	const contents = new Map<string, string>();
	const signal = AbortSignal.timeout(60_000);
	let totalBytes = 0;
	function store(bytes: Uint8Array, directory: string, extension: string) {
		const sha256 = createHash("sha256").update(bytes).digest("hex");
		const file = contents.get(sha256) ?? `${directory}/${sha256}.${extension}`;
		if (!contents.has(sha256)) {
			files[file] = bytes;
			contents.set(sha256, file);
			totalBytes += bytes.length;
		}
		return { file, status: "included" as const, bytes: bytes.length, sha256 };
	}
	async function download(sourceUrl: string, directory: string, avatar: boolean) {
		const previous = downloads.get(sourceUrl);
		if (previous) return previous;
		let asset: Asset;
		try {
			const support = process.env.CHATWOOT_BASE_URL ? new URL(process.env.CHATWOOT_BASE_URL) : undefined;
			async function request(url: URL, redirects = 3): Promise<Response> {
				// Validate every redirect before connecting; never send provider API credentials with file downloads.
				if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !(avatar ? avatarHosts.has(url.hostname) : url.origin === support?.origin)) throw new Error("untrusted_source");
				if (signal.aborted) throw new Error("download_timeout");
				const response = await fetch(url, { redirect: "manual", cache: "no-store", signal });
				if ([301, 302, 303, 307, 308].includes(response.status)) {
					await response.body?.cancel();
					const location = response.headers.get("location");
					if (!redirects || !location) throw new Error("redirect_failed");
					return request(new URL(location, url), redirects - 1);
				}
				return response;
			}
			const limit = Math.min(avatar ? 5 * 1024 * 1024 : 25 * 1024 * 1024, 100 * 1024 * 1024 - totalBytes);
			if (limit <= 0) throw new Error("package_size_limit");
			const response = await request(new URL(sourceUrl));
			if (!response.ok || !response.body) {
				await response.body?.cancel();
				throw new Error("download_failed");
			}
			const mime = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
			if (avatar && !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime)) {
				await response.body.cancel();
				throw new Error("unsupported_image_type");
			}
			if (Number(response.headers.get("content-length")) > limit) {
				await response.body.cancel();
				throw new Error("file_size_limit");
			}
			const reader = response.body.getReader();
			const chunks: Uint8Array[] = [];
			let length = 0;
			try {
				for (;;) {
					const { done, value } = await reader.read();
					if (done) break;
					length += value.length;
					if (length > limit) throw new Error("file_size_limit");
					chunks.push(value);
				}
			} finally {
				await reader.cancel();
			}
			if (!length) throw new Error("empty_file");
			asset = { sourceUrl, ...store(Buffer.concat(chunks), directory, extensions[mime] ?? "bin") };
		} catch (error) {
			const reason = error instanceof Error && ["untrusted_source", "download_timeout", "redirect_failed", "package_size_limit", "download_failed", "unsupported_image_type", "file_size_limit", "empty_file"].includes(error.message) ? error.message : "download_failed";
			asset = { sourceUrl, status: "unavailable", reason };
		}
		downloads.set(sourceUrl, asset);
		assets.push(asset);
		return asset;
	}
	const account = documents["account/account.json"];
	if (account) {
		const team = account.team as Record<string, unknown> | undefined;
		for (const [rows, field] of [
			[records(account.profile), "avatar"],
			[records(account.authUsers), "image"],
			[records(team?.organizations), "logo"],
		] as const) {
			for (const row of rows) {
				if (typeof row[field] !== "string" || !row[field]) continue;
				const asset = await download(row[field], "account/avatars", true);
				if (asset.file) row[`${field}File`] = asset.file;
			}
		}
	}
	for (const row of records(documents["runner/runner.json"]?.brandingAssets)) {
		const bytes = row.bytes as { encoding?: string; value?: string } | null;
		if (bytes?.encoding !== "base64" || typeof bytes.value !== "string") continue;
		const asset = store(Buffer.from(bytes.value, "base64"), "runner/assets", extensions[String(row.normalizedMime)] ?? "bin");
		assets.push(asset);
		delete row.bytes;
		row.archiveFile = asset.file;
	}
	for (const conversation of records(documents["support/conversations.json"]?.conversations)) {
		for (const message of records(conversation.messages)) {
			for (const attachment of records(message.attachments)) {
				if (typeof attachment.data_url !== "string" || !attachment.data_url) continue;
				const asset = await download(attachment.data_url, "support/attachments", false);
				if (asset.file) attachment.archiveFile = asset.file;
			}
		}
	}
	return { files, assets };
}
