import "server-only";
import { getAppAccessToken } from "@/app/actions/twitch";
import type { RunnerNextBroadcast } from "@/app/lib/runnerStandby";

// Cache the public channel schedule briefly; presentation policy polls frequently.
const schedules = new Map<string, { expiresAt: number; value: Promise<RunnerNextBroadcast | null> }>();
/** Owner/Runner authorization is required at the calling boundary. The channel is
 * the Clipify resource owner's Twitch channel, regardless of broadcast destinations. */
export async function readRunnerNextBroadcastInternal(input: { ownerId: string; runnerId: string }, now = new Date()): Promise<RunnerNextBroadcast | null> {
	if (!/^\d+$/.test(input.ownerId) || !Number.isFinite(now.getTime())) return null;
	const cached = schedules.get(input.ownerId);
	if (cached && cached.expiresAt > Date.now()) {
		const value = await cached.value;
		if (!value || Date.parse(value.startUtc) > now.getTime()) return value;
	}
	const value = readChannelSchedule(input.ownerId, now);
	if (schedules.size >= 256) schedules.delete(schedules.keys().next().value!);
	schedules.set(input.ownerId, { expiresAt: Date.now() + 60_000, value });
	return value;
}

async function readChannelSchedule(ownerId: string, now: Date): Promise<RunnerNextBroadcast | null> {
	try {
		const token = await getAppAccessToken();
		if (!token) return null;
		const url = new URL("https://api.twitch.tv/helix/schedule");
		url.search = new URLSearchParams({ broadcaster_id: ownerId, start_time: now.toISOString(), first: "25" }).toString();
		const response = await fetch(url, { headers: { Authorization: `Bearer ${token.access_token}`, "Client-Id": process.env.TWITCH_CLIENT_ID ?? "" }, signal: AbortSignal.timeout(5000), cache: "no-store" });
		if (!response.ok) return null;
		const result = await response.json();
		const data = result?.data;
		if (typeof data?.timezone !== "string" || !Array.isArray(data.segments)) return null;
		new Intl.DateTimeFormat(undefined, { timeZone: data.timezone });
		const candidates: number[] = [];
		for (const segment of data.segments) {
			if (typeof segment?.start_time !== "string" || segment.canceled_until) continue;
			const start = Date.parse(segment.start_time);
			if (!Number.isFinite(start) || start <= now.getTime()) continue;
			const vacation = data.vacation;
			if (vacation && start >= Date.parse(vacation.start_time) && start < Date.parse(vacation.end_time)) continue;
			candidates.push(start);
		}
		if (!candidates.length) return null;
		return { startUtc: new Date(Math.min(...candidates)).toISOString(), timezone: data.timezone };
	} catch {
		// This optional hint must never prevent previewing or broadcasting standby.
		return null;
	}
}
