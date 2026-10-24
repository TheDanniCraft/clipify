/** @jest-environment node */
import { randomUUID } from "node:crypto";
const mockCookies = jest.fn(),
	mockIdentity = jest.fn(),
	mockExecution = jest.fn(),
	mockOwner = jest.fn(),
	mockBenefits = jest.fn(),
	mockProfile = jest.fn(),
	mockSign = jest.fn(),
	mockNextBroadcast = jest.fn();
jest.mock("next/headers", () => ({ cookies: () => mockCookies() }));
jest.mock("@/db/client", () => ({ db: { query: { usersTable: { findFirst: (...args: unknown[]) => mockOwner(...args) } } } }));
jest.mock("@/server/runner/presentation", () => ({ RUNNER_PRESENTATION_COOKIE: "clipify_runner_presentation", RUNNER_PRESENTATION_TTL_SECONDS: 600, signRunnerPresentationIdentity: (...args: unknown[]) => mockSign(...args), verifyRunnerPresentationIdentity: (...args: unknown[]) => mockIdentity(...args), resolveRunnerPresentationExecution: (...args: unknown[]) => mockExecution(...args) }));
jest.mock("@/server/runner/capabilities", () => ({ ...jest.requireActual("@/server/runner/capabilities"), resolveRunnerBenefits: (...args: unknown[]) => mockBenefits(...args) }));
jest.mock("@/server/runner/branding-profiles", () => ({ readRunnerBrandingProfileInternal: (...args: unknown[]) => mockProfile(...args), readRunnerNextBroadcastInternal: (...args: unknown[]) => mockNextBroadcast(...args) }));
const identity = { ownerId: "policy-owner", runnerId: randomUUID(), sessionId: randomUUID(), executionGeneration: randomUUID(), admissionId: randomUUID(), credentialBinding: "a".repeat(64) };
const baselineStandby = { backgroundColor: "#000000", backgroundImageUrl: null, logoUrl: null, message: "" };
const execution = { admission: { benefitsAtStart: { runnerPro: true, validUntil: new Date(0).toISOString() } } };
async function invoke() {
	const route = await import("@/app/runner/presentation/[sessionId]/policy/route");
	return route.GET(new Request(`http://localhost/runner/presentation/${identity.sessionId}/policy`), { params: Promise.resolve({ sessionId: identity.sessionId }) });
}
beforeEach(() => {
	jest.clearAllMocks();
	mockNextBroadcast.mockResolvedValue(null);
	mockSign.mockReturnValue({ token: "renewed-presentation-token", expiresAt: Date.now() + 600000 });
	mockCookies.mockResolvedValue({ get: () => ({ value: "private-cookie" }) });
	mockIdentity.mockReturnValue(identity);
	mockExecution.mockResolvedValue(execution);
	mockOwner.mockResolvedValue({ id: identity.ownerId, plan: "free" });
	mockBenefits.mockResolvedValue({ proAccess: true, validUntil: new Date(Date.now() + 60000) });
	mockProfile.mockResolvedValue({ proShowAttribution: false, watermarkCorner: "top_left", revision: 2 });
});
test("TDD-US4-EXP001 U294: unauthenticated or foreign presentation cookies reveal no appearance policy", async () => {
	mockIdentity.mockReturnValue(null);
	const response = await invoke();
	expect(response.status).toBe(403);
	expect(response.headers.get("cache-control")).toBe("private, no-store");
	expect(mockIdentity).toHaveBeenCalledWith("private-cookie", identity.sessionId);
	expect(mockExecution).not.toHaveBeenCalled();
	expect(mockOwner).not.toHaveBeenCalled();
	expect(response.cookies.get("clipify_runner_presentation")).toBeUndefined();
	expect(mockSign).not.toHaveBeenCalled();
});
test("TDD-US4-EXP001 U294: a revoked or replaced execution cannot refresh its policy", async () => {
	mockExecution.mockResolvedValue(null);
	const response = await invoke();
	expect(response.status).toBe(403);
	expect(mockExecution).toHaveBeenCalledWith(identity);
	expect(mockOwner).not.toHaveBeenCalled();
	expect(response.cookies.get("clipify_runner_presentation")).toBeUndefined();
	expect(mockSign).not.toHaveBeenCalled();
});
test("TDD-US4-EXP001 U294: the current owner benefit extends appearance without mutating captured admission", async () => {
	const captured = structuredClone(execution);
	const until = new Date(Date.now() + 60000);
	mockBenefits.mockResolvedValue({ proAccess: true, validUntil: until });
	const response = await invoke();
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ executionGeneration: identity.executionGeneration, attributionRequired: false, runnerPro: true, validUntil: until.toISOString(), standby: baselineStandby });
	expect(response.headers.get("cache-control")).toBe("private, no-store");
	expect(mockBenefits).toHaveBeenCalledWith({ id: identity.ownerId, plan: "free" });
	expect(mockProfile).toHaveBeenCalledWith({ ownerId: identity.ownerId, runnerId: identity.runnerId });
	expect(execution).toEqual(captured);
});
test("TDD-US4-EXP001 U294: an owner mismatch reveals no paid or saved appearance", async () => {
	mockOwner.mockResolvedValue({ id: "other-owner", plan: "pro" });
	const response = await invoke();
	expect(response.status).toBe(403);
	expect(mockBenefits).not.toHaveBeenCalled();
	expect(mockProfile).not.toHaveBeenCalled();
});
test.each([false, true])("TDD-US4-EXP001 U294: effective expiry requires branding regardless of saved paid choice=%s", async (proShowAttribution) => {
	mockBenefits.mockResolvedValue({ proAccess: false, validUntil: null });
	mockProfile.mockResolvedValue({ proShowAttribution });
	const response = await invoke();
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ executionGeneration: identity.executionGeneration, attributionRequired: true, runnerPro: false, validUntil: null, standby: baselineStandby });
});

test("TDD-US4-EXP001 U294: active policy refresh renews the scoped presentation cookie beyond its original lifetime without extending paid access", async () => {
	const actual = jest.requireActual<typeof import("@/server/runner/presentation")>("@/server/runner/presentation");
	const previous = process.env.JWT_SECRET;
	process.env.JWT_SECRET = "clipify-loopback-presentation-renewal-test-key-2026";
	const start = 1800000000000;
	let now = start;
	jest.useFakeTimers();
	jest.setSystemTime(start);
	try {
		const original = actual.signRunnerPresentationIdentity(identity, now)!;
		let token = original.token;
		mockIdentity.mockImplementation((value, sessionId) => actual.verifyRunnerPresentationIdentity(value, sessionId, now));
		mockCookies.mockImplementation(() => ({ get: () => ({ value: token }) }));
		mockSign.mockImplementation(actual.signRunnerPresentationIdentity);
		const paidEnd = start + 900000;
		mockBenefits.mockResolvedValue({ proAccess: true, validUntil: new Date(paidEnd) });
		now = start + 540000;
		jest.setSystemTime(now);
		const response = await invoke();
		expect(response.status).toBe(200);
		const cookie = response.cookies.get("clipify_runner_presentation");
		expect(cookie).toMatchObject({ value: expect.any(String), path: `/runner/presentation/${identity.sessionId}`, httpOnly: true, sameSite: "strict", maxAge: 600 });
		expect(actual.verifyRunnerPresentationIdentity(original.token, identity.sessionId, start + 660000)).toBeNull();
		expect(actual.verifyRunnerPresentationIdentity(cookie!.value, identity.sessionId, start + 660000)).toEqual(identity);
		expect(actual.verifyRunnerPresentationIdentity(cookie!.value, identity.sessionId, now + 600000)).toBeNull();
		const policy = await response.json();
		expect(policy).toMatchObject({ runnerPro: true, attributionRequired: false, validUntil: new Date(paidEnd).toISOString() });
		expect(JSON.stringify(policy)).not.toContain(cookie!.value);
		token = original.token;
		now = start + 600000;
		jest.setSystemTime(now);
		const stale = await invoke();
		expect(stale.status).toBe(403);
		expect(stale.cookies.get("clipify_runner_presentation")).toBeUndefined();
		expect(mockSign).toHaveBeenCalledTimes(1);
		token = cookie!.value;
		now = start + 940000;
		jest.setSystemTime(now);
		const expired = await invoke();
		expect(expired.status).toBe(200);
		expect(await expired.json()).toMatchObject({ runnerPro: false, attributionRequired: true, validUntil: new Date(paidEnd).toISOString() });
	} finally {
		jest.useRealTimers();
		if (previous === undefined) delete process.env.JWT_SECRET;
		else process.env.JWT_SECRET = previous;
	}
});

test("TDD-US4-EXP001 U294 baseline: signing failure cannot issue a renewed cookie or expose presentation identity", async () => {
	mockSign.mockReturnValue(null);
	const response = await invoke();
	expect(response.status).toBe(503);
	expect(await response.json()).toEqual({ error: "PRESENTATION_UNAVAILABLE" });
	expect(response.cookies.get("clipify_runner_presentation")).toBeUndefined();
	expect(response.headers.get("cache-control")).toBe("private, no-store");
});
test("TDD-US4-EXP001 U294 baseline: HTTPS renewal retains Secure and the exact presentation-session path", async () => {
	const { GET } = await import("@/app/runner/presentation/[sessionId]/policy/route");
	const response = await GET(new Request(`https://clipify.example/runner/presentation/${identity.sessionId}/policy`), { params: Promise.resolve({ sessionId: identity.sessionId }) });
	expect(response.status).toBe(200);
	expect(response.cookies.get("clipify_runner_presentation")).toMatchObject({ secure: true, httpOnly: true, sameSite: "strict", maxAge: 600, path: `/runner/presentation/${identity.sessionId}` });
	expect(mockSign).toHaveBeenCalledWith(identity, expect.any(Number));
});

test("TDD-US4-OPT062 U102: current owner policy includes only its paid saved standby appearance for ongoing output", async () => {
	const logoId = randomUUID(),
		backgroundId = randomUUID();
	mockProfile.mockResolvedValue({ proShowAttribution: false, watermarkCorner: "top_left", standbyBackgroundColor: "#16324f", logoAssetId: logoId, backgroundAssetId: backgroundId, message: "Back soon <3 — thanks for watching!", revision: 4 });
	const response = await invoke();
	expect(response.status).toBe(200);
	const policy = await response.json();
	expect(policy.standby).toEqual({ backgroundColor: "#16324f", backgroundImageUrl: `/runner/presentation/${identity.sessionId}/assets/${backgroundId}`, logoUrl: `/runner/presentation/${identity.sessionId}/assets/${logoId}`, message: "Back soon <3 — thanks for watching!" });
	expect(JSON.stringify(policy)).not.toContain(identity.credentialBinding);
});

test("TDD-US4-OPT063 U103: enabled next-time policy derives the owned Runner schedule without embedding private event data", async () => {
	const next = { startUtc: "2028-01-15T13:00:00.000Z", timezone: "Europe/Berlin" };
	mockNextBroadcast.mockResolvedValue(next);
	mockProfile.mockResolvedValue({ proShowAttribution: false, watermarkCorner: "top_left", standbyBackgroundColor: "#000000", message: "", showNextBroadcastTime: true, revision: 2 });
	const response = await invoke();
	expect(response.status).toBe(200);
	const policy = await response.json();
	expect(policy.standby.nextBroadcast).toEqual(next);
	expect(mockNextBroadcast).toHaveBeenCalledWith({ ownerId: identity.ownerId, runnerId: identity.runnerId });
	expect(JSON.stringify(policy.standby)).not.toContain("eventId");
});
test("TDD-US4-OPT063 U103 baseline: Free policy hides a retained next-time choice and never derives its paid calendar", async () => {
	mockBenefits.mockResolvedValue({ proAccess: false, validUntil: null });
	mockProfile.mockResolvedValue({ proShowAttribution: false, standbyBackgroundColor: "#16324f", message: "Retained paid text", showNextBroadcastTime: true });
	const response = await invoke();
	expect(response.status).toBe(200);
	expect((await response.json()).standby).toEqual(baselineStandby);
	expect(mockNextBroadcast).not.toHaveBeenCalled();
});
