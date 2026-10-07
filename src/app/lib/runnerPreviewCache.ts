type PreviewEntry = {
	image: string;
	timestamp: number;
	size: number;
	overlayId?: string;
	runnerRevision?: number;
};

export class RunnerPreviewCache {
	private readonly entries = new Map<string, PreviewEntry>();
	private totalBytes = 0;

	constructor(
		private readonly ttlMs = 15_000,
		private readonly maxBytes = 32 * 1024 * 1024,
		private readonly now: () => number = Date.now,
	) {}

	set(runnerId: string, image: string, metadata: { overlayId?: string; runnerRevision?: number } = {}) {
		const timestamp = this.now();
		this.pruneExpired(timestamp);
		const existing = this.entries.get(runnerId);
		if (existing) {
			this.entries.delete(runnerId);
			this.totalBytes -= existing.size;
		}

		// Preview frames are validated data URLs containing ASCII-only base64 data.
		const size = image.length;
		if (size > this.maxBytes) return false;
		this.entries.set(runnerId, { image, timestamp, size, ...metadata });
		this.totalBytes += size;
		this.evictOldest();
		return true;
	}

	get(runnerId: string) {
		return this.getEntry(runnerId)?.image ?? null;
	}

	getEntry(runnerId: string) {
		const timestamp = this.now();
		this.pruneExpired(timestamp);
		const entry = this.entries.get(runnerId);
		return entry ? { image: entry.image, timestamp: entry.timestamp, overlayId: entry.overlayId, runnerRevision: entry.runnerRevision } : null;
	}

	delete(runnerId: string) {
		const entry = this.entries.get(runnerId);
		if (!entry) return;
		this.entries.delete(runnerId);
		this.totalBytes -= entry.size;
	}

	get entryCount() {
		return this.entries.size;
	}

	get sizeBytes() {
		return this.totalBytes;
	}

	private pruneExpired(timestamp: number) {
		for (const [runnerId, entry] of this.entries) {
			if (timestamp - entry.timestamp <= this.ttlMs) continue;
			this.entries.delete(runnerId);
			this.totalBytes -= entry.size;
		}
	}

	private evictOldest() {
		while (this.totalBytes > this.maxBytes) {
			const oldest = this.entries.entries().next().value as [string, PreviewEntry] | undefined;
			if (!oldest) break;
			this.entries.delete(oldest[0]);
			this.totalBytes -= oldest[1].size;
		}
	}
}

// Route modules and the MCP handler share the same bounded process-local store.
declare global {
	var __clipifyRunnerPreviewCache: RunnerPreviewCache | undefined;
}
export const runnerPreviewCache = globalThis.__clipifyRunnerPreviewCache ?? (globalThis.__clipifyRunnerPreviewCache = new RunnerPreviewCache());
