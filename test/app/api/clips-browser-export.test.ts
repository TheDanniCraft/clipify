/** @jest-environment node */
import { POST } from "@/app/api/clips/export/browser/route";
const prepare = jest.fn();
jest.mock("@/server/clip-export", () => ({ ...jest.requireActual("@/server/clip-export"), prepareBrowserClipExport: (...args: unknown[]) => prepare(...args) }));
const request = (body = "{}", origin = "https://clipify.test") => new Request("https://clipify.test/api/clips/export/browser", { method: "POST", headers: { origin, "content-type": "application/json" }, body });
beforeEach(() => prepare.mockReset());
it("rejects foreign origins, malformed JSON and oversized bodies before preparing assets", async () => {
	expect((await POST(request("{}", "https://other.test"))).status).toBe(403);
	expect((await POST(request("{"))).status).toBe(400);
	expect((await POST(request(" ".repeat(1024 * 1024 + 1)))).status).toBe(413);
	expect(prepare).not.toHaveBeenCalled();
});
it("returns private recipes and retains typed preparation failures", async () => {
	prepare.mockResolvedValueOnce({ ok: true, clips: [] });
	const response = await POST(request());
	expect(response.status).toBe(200);
	expect(response.headers.get("cache-control")).toBe("private, no-store");
	prepare.mockResolvedValueOnce({ ok: false, code: "RATE_LIMITED", status: 429 });
	expect((await POST(request())).status).toBe(429);
});
