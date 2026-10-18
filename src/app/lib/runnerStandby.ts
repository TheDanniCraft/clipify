export type RunnerNextBroadcast = { startUtc: string; timezone: string };
export type RunnerStandbyAppearance = { backgroundColor: string; backgroundImageUrl: string | null; logoUrl: string | null; message: string; nextBroadcast?: RunnerNextBroadcast | null };
/** Accept only bounded plain text and same-origin, execution-scoped asset references. */
export function parseRunnerStandbyAppearance(value: unknown): RunnerStandbyAppearance | null {
	if (!value || typeof value !== "object") return null;
	const appearance = value as Record<string, unknown>;
	const asset = (input: unknown): input is string | null => input === null || (typeof input === "string" && /^\/runner\/presentation\/[a-f0-9-]{36}\/assets\/[a-f0-9-]{36}$/i.test(input));
	if (typeof appearance.backgroundColor !== "string" || !/^#[a-f0-9]{6}$/i.test(appearance.backgroundColor) || typeof appearance.message !== "string" || appearance.message.length > 160 || !asset(appearance.backgroundImageUrl) || !asset(appearance.logoUrl)) return null;
	let nextBroadcast: RunnerNextBroadcast | null | undefined;
	if ("nextBroadcast" in appearance) {
		if (appearance.nextBroadcast === null) nextBroadcast = null;
		else {
			const next = appearance.nextBroadcast;
			if (!next || typeof next !== "object" || !("startUtc" in next) || typeof next.startUtc !== "string" || !Number.isFinite(Date.parse(next.startUtc)) || !("timezone" in next) || typeof next.timezone !== "string" || next.timezone.length > 128) return null;
			try {
				new Intl.DateTimeFormat("en-GB", { timeZone: next.timezone });
			} catch {
				return null;
			}
			nextBroadcast = { startUtc: next.startUtc, timezone: next.timezone };
		}
	}
	return { backgroundColor: appearance.backgroundColor, backgroundImageUrl: appearance.backgroundImageUrl, logoUrl: appearance.logoUrl, message: appearance.message, ...(nextBroadcast !== undefined ? { nextBroadcast } : {}) };
}
