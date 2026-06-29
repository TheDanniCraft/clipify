import { Plan } from "@types";

import type { CommunityStreamer } from "@/app/lib/community-types";
import { compareCommunityStreamers } from "@/app/lib/communitySort";

describe("compareCommunityStreamers", () => {
	it("orders community streamers by partner, status, plan, views, then recency", () => {
		const streamers = [
			{
				id: "offline-pro",
				displayName: "Offline Pro",
				username: "offline-pro",
				avatar: "https://example.com/offline-pro.png",
				plan: Plan.Pro,
				viewCount: 10,
				partner: false,
				status: "offline",
				lastActiveAt: "2026-06-28T00:00:00.000Z",
			},
			{
				id: "live-free",
				displayName: "Live Free",
				username: "live-free",
				avatar: "https://example.com/live-free.png",
				plan: Plan.Free,
				viewCount: 20,
				partner: false,
				status: "live",
				lastActiveAt: "2026-06-28T01:00:00.000Z",
			},
			{
				id: "overlay-free",
				displayName: "Overlay Free",
				username: "overlay-free",
				avatar: "https://example.com/overlay-free.png",
				plan: Plan.Free,
				viewCount: 30,
				partner: false,
				status: "live_with_overlay",
				lastActiveAt: "2026-06-27T23:00:00.000Z",
			},
			{
				id: "overlay-pro",
				displayName: "Overlay Pro",
				username: "overlay-pro",
				avatar: "https://example.com/overlay-pro.png",
				plan: Plan.Pro,
				viewCount: 40,
				partner: false,
				status: "live_with_overlay",
				lastActiveAt: "2026-06-27T22:00:00.000Z",
			},
		] satisfies CommunityStreamer[];

		streamers.sort(compareCommunityStreamers);

		expect(streamers.map((streamer) => streamer.id)).toEqual(["overlay-pro", "overlay-free", "live-free", "offline-pro"]);
	});

	it("prefers pro accounts within the same status bucket", () => {
		const streamers = [
			{
				id: "free",
				displayName: "Free",
				username: "free",
				avatar: "https://example.com/free.png",
				plan: Plan.Free,
				viewCount: 100,
				partner: false,
				status: "live",
				lastActiveAt: "2026-06-28T01:00:00.000Z",
			},
			{
				id: "pro",
				displayName: "Pro",
				username: "pro",
				avatar: "https://example.com/pro.png",
				plan: Plan.Pro,
				viewCount: 10,
				partner: false,
				status: "live",
				lastActiveAt: "2026-06-28T00:00:00.000Z",
			},
		] satisfies CommunityStreamer[];

		streamers.sort(compareCommunityStreamers);

		expect(streamers.map((streamer) => streamer.id)).toEqual(["pro", "free"]);
	});

	it("prefers partners before everyone else", () => {
		const streamers = [
			{
				id: "non-partner-live",
				displayName: "Non Partner Live",
				username: "non-partner-live",
				avatar: "https://example.com/non-partner-live.png",
				plan: Plan.Pro,
				viewCount: 500,
				partner: false,
				status: "live_with_overlay",
				lastActiveAt: "2026-06-28T02:00:00.000Z",
			},
			{
				id: "partner-offline",
				displayName: "Partner Offline",
				username: "partner-offline",
				avatar: "https://example.com/partner-offline.png",
				plan: Plan.Free,
				viewCount: 1,
				partner: true,
				status: "offline",
				lastActiveAt: "2026-06-28T03:00:00.000Z",
			},
		] satisfies CommunityStreamer[];

		streamers.sort(compareCommunityStreamers);

		expect(streamers.map((streamer) => streamer.id)).toEqual(["partner-offline", "non-partner-live"]);
	});

	it("prefers higher Twitch view counts before alphabetical order", () => {
		const streamers = [
			{
				id: "alpha",
				displayName: "Alpha",
				username: "alpha",
				avatar: "https://example.com/alpha.png",
				plan: Plan.Free,
				viewCount: 50,
				partner: false,
				status: "offline",
				lastActiveAt: "2026-06-28T00:00:00.000Z",
			},
			{
				id: "beta",
				displayName: "Beta",
				username: "beta",
				avatar: "https://example.com/beta.png",
				plan: Plan.Free,
				viewCount: 10,
				partner: false,
				status: "offline",
				lastActiveAt: "2026-06-28T00:00:00.000Z",
			},
		] satisfies CommunityStreamer[];

		streamers.sort(compareCommunityStreamers);

		expect(streamers.map((streamer) => streamer.id)).toEqual(["alpha", "beta"]);
	});
});
