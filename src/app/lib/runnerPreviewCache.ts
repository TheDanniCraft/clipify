type PreviewEntry = {
	image: string;
	timestamp: number;
	size: number;
};

export class RunnerPreviewCache {
	private readonly entries = new Map<string, PreviewEntry>();
	private totalBytes = 0;

	constructor(
		private readonly ttlMs = 15_000,
		private readonly maxBytes = 32 * 1024 * 1024,
		private readonly now: () => number = Date.now,
	) {}

	set(runnerId: string, image: string) {
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
		this.entries.set(runnerId, { image, timestamp, size });
		this.totalBytes += size;
		this.evictOldest();
		return true;
	}

	get(runnerId: string) {
		const timestamp = this.now();
		this.pruneExpired(timestamp);
		return this.entries.get(runnerId)?.image ?? null;
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
