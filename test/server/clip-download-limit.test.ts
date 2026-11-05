/** @jest-environment node */
import { reserveClipDownloadJob, reserveTwitchClipDownloadRequest, reserveClipExportVolume } from "@/server/clip-download-limit";
import { consumeDatabaseRateLimit } from "@/auth/rate-limit";
jest.mock("@/auth/rate-limit", () => ({ consumeDatabaseRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 1 }) }));
it("coordinates manual formats and provider requests by the creator, never the viewer or network", async () => {
	await reserveClipDownloadJob("creator");
	await reserveTwitchClipDownloadRequest("creator");
	expect(consumeDatabaseRateLimit).toHaveBeenNthCalledWith(1, expect.objectContaining({ identityKey: "creator", networkKey: "creator", action: "clip-download-job", limit: 3, windowMs: 60000 }));
	expect(consumeDatabaseRateLimit).toHaveBeenNthCalledWith(2, expect.objectContaining({ identityKey: "creator", networkKey: "creator", action: "twitch-clip-download", limit: 100, windowMs: 60000 }));
});

it("counts clips rather than provider calls for the shared fifty-clip minute budget", async () => {
	await reserveClipExportVolume("creator", 50);
	expect(consumeDatabaseRateLimit).toHaveBeenLastCalledWith(expect.objectContaining({ identityKey: "creator", networkKey: "creator", action: "clip-export-volume", limit: 50, cost: 50, windowMs: 60000 }));
});
