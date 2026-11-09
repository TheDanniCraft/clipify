/** @jest-environment node */
jest.mock("@/app/actions/events", () => ({ completeEventGoogleConnectionAction: jest.fn() }));
import { GET } from "@/app/dashboard/events/connect/[provider]/complete/route";
import { completeEventGoogleConnectionAction } from "@/app/actions/events";
const publicOrigin = "https://beta-560.clipify.cloud.thedannicraft.de";
const previousEnvironment = { ...process.env };
beforeEach(() => {
	process.env.COOLIFY_URL = publicOrigin;
	process.env.COOLIFY_RESOURCE_UUID = "preview-fixture";
	process.env.NEXT_PUBLIC_BASE_URL = "https://clipify.us";
	jest.clearAllMocks();
});
afterEach(() => {
	process.env = { ...previousEnvironment };
});
it.each([true, false])("returns a %s connection to the public event editor behind the proxy", async (connected) => {
	jest.mocked(completeEventGoogleConnectionAction).mockResolvedValue({ ok: true, connection: { connected, returnPath: "/dashboard/events/example" } } as never);
	const response = await GET(new Request("http://0.0.0.0:3000/dashboard/events/connect/drive/complete?intent=fixture"), { params: Promise.resolve({ provider: "drive" }) });
	expect(response.headers.get("location")).toBe(`${publicOrigin}/dashboard/events/example?section=connections&provider=drive&connection=${connected ? "connected" : "retry"}`);
	expect(completeEventGoogleConnectionAction).toHaveBeenCalledWith("drive", "fixture");
});
it("returns a missing session to the public login", async () => {
	jest.mocked(completeEventGoogleConnectionAction).mockResolvedValue({ ok: false, code: "AUTHENTICATION_REQUIRED" });
	const response = await GET(new Request("http://0.0.0.0:3000/dashboard/events/connect/youtube/complete"), { params: Promise.resolve({ provider: "youtube" }) });
	expect(response.headers.get("location")).toBe(`${publicOrigin}/login`);
});
it("returns an unsupported provider to the public event library", async () => {
	const response = await GET(new Request("http://0.0.0.0:3000/dashboard/events/connect/unsupported/complete"), { params: Promise.resolve({ provider: "unsupported" }) });
	expect(response.headers.get("location")).toBe(`${publicOrigin}/dashboard/events`);
	expect(completeEventGoogleConnectionAction).not.toHaveBeenCalled();
});
