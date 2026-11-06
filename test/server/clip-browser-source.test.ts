/** @jest-environment node */
import jwt from "jsonwebtoken";
import { signBrowserClipSource, readBrowserClipSource } from "@/server/clip-browser-source";
it("accepts a creator/clip-scoped source ticket and rejects modification, expiry and unrelated JWTs", () => {
	jest.useFakeTimers().setSystemTime(new Date("2026-11-06T00:00:00Z"));
	try {
		const ticket = signBrowserClipSource("owner", "ClipA");
		expect(readBrowserClipSource(ticket)).toEqual({ creatorId: "owner", clipId: "ClipA" });
		expect(readBrowserClipSource(ticket + "x")).toBeNull();
		expect(readBrowserClipSource("not-a-ticket")).toBeNull();
		jest.advanceTimersByTime(270 * 60000);
		expect(readBrowserClipSource(ticket)).toEqual({ creatorId: "owner", clipId: "ClipA" });
		jest.advanceTimersByTime(90 * 60000 + 1000);
		expect(readBrowserClipSource(ticket)).toBeNull();
	} finally {
		jest.useRealTimers();
	}
});

it("rejects otherwise signed tickets for another audience, algorithm or invalid clip claim", () => {
	const secret = process.env.JWT_SECRET!;
	const sign = (payload: object, options: jwt.SignOptions) => jwt.sign(payload, secret, { issuer: "clipify.us", audience: "clipify-browser-source", expiresIn: 3600, ...options });
	expect(readBrowserClipSource(sign({ creatorId: "owner", clipId: "ClipA" }, { audience: "another-api" }))).toBeNull();
	expect(readBrowserClipSource(sign({ creatorId: "owner", clipId: "ClipA" }, { algorithm: "HS384" }))).toBeNull();
	expect(readBrowserClipSource(sign({ creatorId: "owner", clipId: "../ClipA" }, { algorithm: "HS256" }))).toBeNull();
});
