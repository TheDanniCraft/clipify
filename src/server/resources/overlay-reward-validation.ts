import "server-only";
import { getAccessTokenInternal } from "@/server/tokens";

/** Resolve the creator's credentials and reward before acquiring mutation locks. */
export async function validateOwnedOverlayReward(creatorId: string, rewardId: string): Promise<void> {
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			controller.abort();
			reject(new Error("SERVICE_UNAVAILABLE"));
		}, 5000);
	});
	const validate = async () => {
		const token = await getAccessTokenInternal(creatorId);
		const clientId = process.env.TWITCH_CLIENT_ID;
		if (!token || !clientId || controller.signal.aborted) throw new Error("SERVICE_UNAVAILABLE");
		const url = new URL("https://api.twitch.tv/helix/channel_points/custom_rewards");
		url.searchParams.set("broadcaster_id", creatorId);
		url.searchParams.set("id", rewardId);
		const response = await fetch(url.toString(), { method: "GET", headers: { Authorization: `Bearer ${token.accessToken}`, "Client-Id": clientId }, redirect: "error", signal: controller.signal });
		const reader = response.body?.getReader();
		try {
			if (!response.ok || !response.headers.get("content-type")?.split(";")[0].trim().toLowerCase().endsWith("/json") || !reader) throw new Error("SERVICE_UNAVAILABLE");
			const chunks: Uint8Array[] = [];
			let size = 0;
			while (true) {
				const chunk = await reader.read();
				if (chunk.done) break;
				size += chunk.value.byteLength;
				if (size > 65536) throw new Error("SERVICE_UNAVAILABLE");
				chunks.push(chunk.value);
			}
			const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
			if (!Array.isArray(payload?.data) || payload.data.length !== 1 || payload.data[0]?.id !== rewardId || payload.data[0]?.broadcaster_id !== creatorId) throw new Error("INVALID_INPUT");
		} finally {
			await reader?.cancel().catch(() => undefined);
			reader?.releaseLock();
		}
	};
	try {
		await Promise.race([validate(), deadline]);
	} catch {
		throw new Error("SERVICE_UNAVAILABLE");
	} finally {
		clearTimeout(timer);
		controller.abort();
	}
}
