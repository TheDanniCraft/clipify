/** @jest-environment node */
export {};

const validateAuth = jest.fn();
const getMemberProfile = jest.fn();
const getPublicMemberProfile = jest.fn();
const renderImage = jest.fn();

jest.mock("@actions/auth", () => ({ validateAuth: (...args: unknown[]) => validateAuth(...args) }));
jest.mock("@lib/membership", () => ({
	getMemberProfile: (...args: unknown[]) => getMemberProfile(...args),
	getPublicMemberProfile: (...args: unknown[]) => getPublicMemberProfile(...args),
}));

// Keep the real card renderer's response options; bypass only rasterization.
jest.mock("next/og", () => ({
	ImageResponse: class extends Response {
		constructor(_element: unknown, options: { headers: Record<string, string> }) {
			super("png", { headers: { "Content-Type": "image/png", ...options.headers } });
			renderImage(_element);
		}
	},
}));

const cardId = "025dcf9a-10f5-47ad-a6f0-cbe1151b6fbc";
const profile = { cardId, avatar: "", username: "member_42", memberNumber: 42, joinedAt: new Date("2026-01-02T00:00:00Z"), badges: [] };
const request = (query = "") => new Request(`https://clipify.test/api/member-card${query}`);
const context = { params: Promise.resolve({ cardId }) };

describe("member-card image routes", () => {
	afterEach(() => jest.restoreAllMocks());
	beforeEach(() => {
		jest.clearAllMocks();
		validateAuth.mockResolvedValue({ id: "owner" });
		getMemberProfile.mockResolvedValue(profile);
		getPublicMemberProfile.mockResolvedValue(profile);
	});

	it("rejects an unauthenticated private request before loading a profile", async () => {
		validateAuth.mockResolvedValue(null);
		const { GET } = await import("@/app/api/member-card/route");
		const response = await GET(request());
		expect(response.status).toBe(401);
		expect(await response.text()).toBe("Unauthorized");
		expect(getMemberProfile).not.toHaveBeenCalled();
	});

	it("returns 404 when the authenticated member no longer exists", async () => {
		getMemberProfile.mockResolvedValue(null);
		const { GET } = await import("@/app/api/member-card/route");
		expect((await GET(request())).status).toBe(404);
		expect(getMemberProfile).toHaveBeenCalledWith("owner");
	});

	it("returns a private PNG using the authenticated identity, not a query parameter", async () => {
		const { GET } = await import("@/app/api/member-card/route");
		const response = await GET(request("?username=someone_else"));
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/png");
		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
		expect(response.headers.has("Content-Disposition")).toBe(false);
		expect(getMemberProfile).toHaveBeenCalledWith("owner");
	});

	it("sets attachment and private cache headers for a private download", async () => {
		const { GET } = await import("@/app/api/member-card/route");
		const response = await GET(request("?download=1"));
		expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="clipify-member-member_42.png"');
		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
	});

	it("embeds the Twitch avatar without following redirects", async () => {
		const fetchAvatar = jest.spyOn(global, "fetch").mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png" } }));
		getMemberProfile.mockResolvedValue({ ...profile, avatar: "https://static-cdn.jtvnw.net/avatar.png" });
		const { GET } = await import("@/app/api/member-card/route");
		expect((await GET(request())).status).toBe(200);
		expect(fetchAvatar).toHaveBeenCalledWith("https://static-cdn.jtvnw.net/avatar.png", expect.objectContaining({ redirect: "error", signal: expect.any(AbortSignal) }));
		expect(JSON.stringify(renderImage.mock.calls[0][0])).toContain("data:image/png;base64,AQID");
	});

	it("still exports a card if the avatar fetch fails", async () => {
		jest.spyOn(global, "fetch").mockRejectedValue(new Error("avatar unavailable"));
		getMemberProfile.mockResolvedValue({ ...profile, avatar: "https://static-cdn.jtvnw.net/avatar.png" });
		const { GET } = await import("@/app/api/member-card/route");
		expect((await GET(request("?download=1"))).status).toBe(200);
		expect(JSON.stringify(renderImage.mock.calls[0][0])).not.toContain("data:image/");
	});

	it("never fetches an arbitrary stored avatar destination", async () => {
		const fetchAvatar = jest.spyOn(global, "fetch");
		getMemberProfile.mockResolvedValue({ ...profile, avatar: "http://127.0.0.1/private" });
		const { GET } = await import("@/app/api/member-card/route");
		expect((await GET(request())).status).toBe(200);
		expect(fetchAvatar).not.toHaveBeenCalled();
	});

	it.each(["", "?download=0", "?download=true"])("does not force a download for query %s", async (query) => {
		const { GET } = await import("@/app/api/member-card/route");
		expect((await GET(request(query))).headers.has("Content-Disposition")).toBe(false);
	});

	it("returns 404 for an unavailable public member", async () => {
		getPublicMemberProfile.mockResolvedValue(null);
		const { GET } = await import("@/app/api/member-card/public/[cardId]/route");
		const response = await GET(request(), context);
		expect(response.status).toBe(404);
		expect(await response.text()).toBe("Member not found");
		expect(response.headers.has("Content-Disposition")).toBe(false);
	});

	it("serves a cacheable public PNG without requiring authentication", async () => {
		const { GET } = await import("@/app/api/member-card/public/[cardId]/route");
		const response = await GET(request(), context);
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/png");
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
		expect(getPublicMemberProfile).toHaveBeenCalledWith(cardId);
		expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
		expect(validateAuth).not.toHaveBeenCalled();
	});

	it("preserves attachment headers when adding public caching", async () => {
		const { GET } = await import("@/app/api/member-card/public/[cardId]/route");
		const response = await GET(request("?download=1"), context);
		expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="clipify-member-member_42.png"');
		expect(response.headers.get("Cache-Control")).toContain("public");
	});
});
