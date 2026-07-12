/** @jest-environment node */

const insertMock = jest.fn();
const queryEnrollmentMock = jest.fn();
const queryRunnerMock = jest.fn();
const validateAuthMock = jest.fn();

jest.mock("@/db/client", () => ({
	db: {
		insert: (...args: unknown[]) => insertMock(...args),
		query: {
			runnerEnrollmentsTable: { findFirst: (...args: unknown[]) => queryEnrollmentMock(...args) },
			runnersTable: { findFirst: (...args: unknown[]) => queryRunnerMock(...args) },
		},
	},
}));

jest.mock("@/app/actions/auth", () => ({
	validateAuth: () => validateAuthMock(),
}));

jest.mock("@actions/rateLimit", () => ({
	tryRateLimit: jest.fn().mockResolvedValue({ success: true, remaining: 9 }),
}));

describe("runner enrollment routes", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("starts enrollment with verification URL on the request origin", async () => {
		const values = jest.fn().mockResolvedValue(undefined);
		insertMock.mockReturnValue({ values });
		const { POST } = await import("@/app/api/runner/enroll/start/route");

		const res = await POST({
			nextUrl: new URL("https://beta-315.clipify.cloud.thedannicraft.de/api/runner/enroll/start"),
			json: async () => ({ hostname: "vm-1", os: "Linux", version: "dev" }),
		} as never);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.verificationUri).toBe("https://beta-315.clipify.cloud.thedannicraft.de/runner/enroll");
		expect(body).not.toHaveProperty("verificationUriComplete");
		expect(body.userCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
		expect(values).toHaveBeenCalledWith(expect.objectContaining({ apiBase: "https://beta-315.clipify.cloud.thedannicraft.de", hostname: "vm-1" }));
	});

	it("rejects malformed enrollment codes before lookup", async () => {
		const { isValidUserCode } = await import("@/app/runner/enroll/code");
		expect(isValidUserCode("1111111")).toBe(false);
		expect(isValidUserCode("V48H-VKN5")).toBe(true);
	});

	it("returns pending while enrollment is not approved", async () => {
		queryEnrollmentMock.mockResolvedValue({
			deviceCode: "device",
			expiresAt: new Date(Date.now() + 60_000),
			runnerId: null,
		});
		const { POST } = await import("@/app/api/runner/enroll/poll/route");

		const res = await POST(new Request("https://clipify.us/api/runner/enroll/poll", { method: "POST", body: JSON.stringify({ deviceCode: "device" }) }));

		expect(res.status).toBe(202);
		await expect(res.json()).resolves.toEqual({ status: "pending" });
	});

	it("keeps targeted runner enrollments pending until approval", async () => {
		queryEnrollmentMock.mockResolvedValue({
			deviceCode: "device",
			expiresAt: new Date(Date.now() + 60_000),
			runnerId: "runner-1",
			approvedAt: null,
		});
		const { POST } = await import("@/app/api/runner/enroll/poll/route");

		const res = await POST(new Request("https://clipify.us/api/runner/enroll/poll", { method: "POST", body: JSON.stringify({ deviceCode: "device" }) }));

		expect(res.status).toBe(202);
		await expect(res.json()).resolves.toEqual({ status: "pending" });
	});

	it("returns credentials after approval", async () => {
		queryEnrollmentMock.mockResolvedValue({
			deviceCode: "device",
			expiresAt: new Date(Date.now() + 60_000),
			runnerId: "runner-1",
			approvedAt: new Date(),
			apiBase: "https://clipify.us",
		});
		queryRunnerMock.mockResolvedValue({ id: "runner-1", token: "cl_run_secret" });
		const { POST } = await import("@/app/api/runner/enroll/poll/route");

		const res = await POST(new Request("https://clipify.us/api/runner/enroll/poll", { method: "POST", body: JSON.stringify({ deviceCode: "device" }) }));

		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ status: "approved", apiBase: "https://clipify.us", runnerId: "runner-1", token: "cl_run_secret" });
	});

	it("rejects expired device codes", async () => {
		queryEnrollmentMock.mockResolvedValue({
			deviceCode: "device",
			expiresAt: new Date(Date.now() - 60_000),
			runnerId: null,
		});
		const { POST } = await import("@/app/api/runner/enroll/poll/route");

		const res = await POST(new Request("https://clipify.us/api/runner/enroll/poll", { method: "POST", body: JSON.stringify({ deviceCode: "device" }) }));

		expect(res.status).toBe(410);
	});
});
