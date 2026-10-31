export const publicHeatmapPaths = ["/", "/features", "/pricing", "/community", "/changelog", "/roadmap"] as const;

export function canRecordHeatmap(rawUrl: string, origin: string) {
	try {
		const url = new URL(rawUrl, origin);
		return url.origin === origin && !url.username && !url.password && publicHeatmapPaths.some((path) => path === (url.pathname.replace(/\/$/, "") || "/")) && [...url.searchParams.keys()].every((key) => /^utm_(?:source|medium|campaign|content|term)$/.test(key));
	} catch {
		return false;
	}
}
