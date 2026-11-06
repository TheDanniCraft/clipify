/** @jest-environment node */
import { signBrowserClipSource, readBrowserClipSource } from "@/server/clip-browser-source";
it("accepts a creator/clip-scoped source ticket and rejects modification, expiry and unrelated JWTs", () => {
	jest.useFakeTimers().setSystemTime(new Date("2026-11-06T00:00:00Z"));
	try {
		const ticket = signBrowserClipSource("owner", "ClipA");
		expect(readBrowserClipSource(ticket)).toEqual({ creatorId: "owner", clipId: "ClipA" });
		expect(readBrowserClipSource(ticket + "x")).toBeNull();
		expect(readBrowserClipSource("not-a-ticket")).toBeNull();
		jest.advanceTimersByTime(3601000);
		expect(readBrowserClipSource(ticket)).toBeNull();
	} finally {
		jest.useRealTimers();
	}
});
