/** @jest-environment node */
const authorize = jest.fn(),
	read = jest.fn();
jest.mock("@/auth/authorize-operation", () => ({ authorizeCreatorOperation: (...args: unknown[]) => authorize(...args) }));
jest.mock("@/server/clip-composition-render", () => ({ readClipCompositionLogo: (...args: unknown[]) => read(...args) }));
import { GET } from "@/app/api/clips/layout-logo/route";
beforeEach(() => {
	jest.clearAllMocks();
});
it("never fetches an image without creator access or from a client URL", async () => {
	authorize.mockResolvedValue({ allowed: false, code: "PERMISSION_DENIED" });
	expect((await GET(new Request("http://localhost/api/clips/layout-logo?creatorId=owner&url=https://evil.test"))).status).toBe(403);
	expect(read).not.toHaveBeenCalled();
	expect((await GET(new Request("http://localhost/api/clips/layout-logo"))).status).toBe(400);
});
it("serves only the authorized profile image with private headers and recoverable failure", async () => {
	authorize.mockResolvedValue({ allowed: true, creator: { avatar: "https://static-cdn.jtvnw.net/owner.png" } });
	read.mockResolvedValue(Buffer.from([1, 2]));
	const response = await GET(new Request("http://localhost/api/clips/layout-logo?creatorId=owner&url=https://evil.test"));
	expect(response.status).toBe(200);
	expect(response.headers.get("cache-control")).toBe("private, no-store");
	expect(response.headers.get("content-type")).toBe("image/png");
	expect(read).toHaveBeenCalledWith("https://static-cdn.jtvnw.net/owner.png", expect.any(AbortSignal));
	read.mockRejectedValue(Error("offline"));
	expect((await GET(new Request("http://localhost/api/clips/layout-logo?creatorId=owner"))).status).toBe(502);
});
