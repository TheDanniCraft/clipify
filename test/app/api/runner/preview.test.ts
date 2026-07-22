/** @jest-environment node */

const mockRunnerFindFirst = jest.fn();
const mockSessionFindFirst = jest.fn();
const mockEditorFindFirst = jest.fn();
const mockValidateAuth = jest.fn();

jest.mock("@/db/client", () => ({
	db: {
		query: {
			runnersTable: { findFirst: (...args: unknown[]) => mockRunnerFindFirst(...args) },
			streamSessionsTable: { findFirst: (...args: unknown[]) => mockSessionFindFirst(...args) },
			editorsTable: { findFirst: (...args: unknown[]) => mockEditorFindFirst(...args) },
		},
	},
}));

jest.mock("@actions/auth", () => ({
	validateAuth: (...args: unknown[]) => mockValidateAuth(...args),
}));

jest.mock("@actions/rateLimit", () => ({
	tryRateLimit: jest.fn().mockResolvedValue({ success: true, remaining: 39 }),
}));

describe("runner preview route", () => {
	beforeEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
		mockRunnerFindFirst.mockResolvedValue({ id: "runner-1", ownerId: "owner-1" });
		mockSessionFindFirst.mockResolvedValue({ id: "session-1", runnerId: "runner-1", overlayId: "overlay-1" });
		mockEditorFindFirst.mockResolvedValue(null);
	});

	it("serves cached preview frames by runner id to the runner owner", async () => {
		mockValidateAuth.mockResolvedValue({ id: "owner-1" });
		const { POST, GET } = await import("@/app/api/runner/preview/route");
		const image = "data:image/jpeg;base64,ZmFrZQ==";

		const post = await POST(
			new Request("https://clipify.us/api/runner/preview", {
				method: "POST",
				headers: { authorization: "Bearer cl_run_token", "content-type": "application/json" },
				body: JSON.stringify({ overlayId: "overlay-1", image }),
			}),
		);
		expect(post.status).toBe(200);

		const get = await GET(new Request("https://clipify.us/api/runner/preview?runnerId=runner-1"));
		expect(get.status).toBe(200);
		await expect(get.json()).resolves.toEqual({ image });
	});

	it("requires authentication before reading a preview frame", async () => {
		mockValidateAuth.mockResolvedValue(null);
		const { GET } = await import("@/app/api/runner/preview/route");

		const get = await GET(new Request("https://clipify.us/api/runner/preview?runnerId=runner-1"));

		expect(get.status).toBe(401);
	});

	it("does not serve preview frames to users without runner owner access", async () => {
		const { POST, GET } = await import("@/app/api/runner/preview/route");
		const image = "data:image/jpeg;base64,ZmFrZQ==";
		await POST(
			new Request("https://clipify.us/api/runner/preview", {
				method: "POST",
				headers: { authorization: "Bearer cl_run_token", "content-type": "application/json" },
				body: JSON.stringify({ overlayId: "overlay-1", image }),
			}),
		);
		mockValidateAuth.mockResolvedValue({ id: "other-user" });

		const get = await GET(new Request("https://clipify.us/api/runner/preview?runnerId=runner-1"));

		expect(get.status).toBe(403);
	});
});
