/** @jest-environment node */
export {};
const authorize = jest.fn();
const render = jest.fn();
jest.mock("@/auth/authorize-operation", () => ({ authorizeCreatorOperation: (...args: unknown[]) => authorize(...args) }));
jest.mock("@/server/brand-font-render", () => ({ renderBrandWidget: (...args: unknown[]) => render(...args) }));
const rate = jest.fn().mockResolvedValue({ success: true });
const logo = jest.fn();
jest.mock("@/server/clip-composition-render", () => ({ readClipCompositionLogo: (...args: unknown[]) => logo(...args) }));
jest.mock("@/server/rate-limit", () => ({ consumeAppRateLimit: (...args: unknown[]) => rate(...args) }));
it("renders bounded authorized previews and denies arbitrary pixel allocations", async () => {
	const route = await import("@/app/api/clips/widget-preview/route").catch(() => null);
	expect(route).not.toBeNull();
	if (!route) return;
	authorize.mockResolvedValue({ allowed: true, creator: { avatar: "" } });
	render.mockResolvedValue(Buffer.from([137, 80, 78, 71]));
	const body = { creatorId: "owner", kind: "title", width: 720, height: 120, fontSize: 32, clip: { title: "A clip", clipCreatorName: "Viewer" }, theme: { fontFamily: "Laila", fontSource: "google" } };
	const req = (input: unknown) => new Request("http://localhost/api/clips/widget-preview", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost" }, body: JSON.stringify(input) });
	expect((await route.POST(req(body))).status).toBe(200);
	expect((await route.POST(req({ ...body, width: 1000000 }))).status).toBe(400);
	authorize.mockResolvedValue({ allowed: false, code: "PERMISSION_DENIED" });
	render.mockClear();
	expect((await route.POST(req(body))).status).toBe(403);
	expect(render).not.toHaveBeenCalled();
});

it("handles GET validation, unavailable fonts, logo fallback and concurrent preview capacity", async () => {
	const { POST, GET } = await import("@/app/api/clips/widget-preview/route");
	const body = { creatorId: "owner", kind: "channel", width: 720, height: 120, fontSize: 32, clip: { title: "A clip" }, theme: {} };
	const req = (data = body) => new Request("http://localhost/api/clips/widget-preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
	expect((await GET(new Request("http://localhost/api/clips/widget-preview"))).status).toBe(400);
	expect((await GET(new Request("http://localhost/api/clips/widget-preview?data=" + "x".repeat(9000)))).status).toBe(400);
	expect((await POST(new Request("http://localhost/api/clips/widget-preview", { method: "POST" }))).status).toBe(400);
	authorize.mockResolvedValue({ allowed: true, creator: { avatar: "https://static-cdn.jtvnw.net/logo.png" } });
	render.mockResolvedValue(Buffer.from([1]));
	logo.mockResolvedValue(Buffer.from([1]));
	expect((await GET(new Request("http://localhost/api/clips/widget-preview?data=" + encodeURIComponent(JSON.stringify(body))))).status).toBe(200);
	logo.mockRejectedValue(Error("offline"));
	expect((await POST(req())).status).toBe(200);
	rate.mockResolvedValueOnce({ success: false });
	expect((await POST(req())).status).toBe(429);
	render.mockRejectedValueOnce(Error("font_unavailable"));
	expect((await POST(req())).status).toBe(502);
	const waiting: Array<(value: Buffer) => void> = [];
	render.mockImplementation(() => new Promise<Buffer>((resolve) => waiting.push(resolve)));
	const first = POST(req()),
		second = POST(req());
	for (let i = 0; i < 100 && waiting.length < 2; i++) await new Promise((resolve) => setTimeout(resolve, 5));
	expect(waiting).toHaveLength(2);
	expect((await POST(req())).status).toBe(429);
	waiting.forEach((resolve) => resolve(Buffer.from([1])));
	expect((await Promise.all([first, second])).every((response) => response.status === 200)).toBe(true);
});
