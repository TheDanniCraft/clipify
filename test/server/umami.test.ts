/** @jest-environment node */
import { queryUmami, sendServerProductEvent, trackCommittedProductEvent, trackCommittedCreatorOutcome, trackServerProductEvent } from "@/server/umami";
import { getCreatorAnalyticsRuntimeMetrics } from "@/app/lib/plausibleCreatorAnalytics";
const allowed = jest.fn();
const callbacks: Array<() => Promise<void>> = [];
const selectRows = jest.fn();
jest.mock("next/server", () => ({ after: (callback: () => Promise<void>) => callbacks.push(callback) }));
jest.mock("@/db/client", () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: (...args: unknown[]) => selectRows(...args) }) }) }) } }));
jest.mock("@/server/analytics-consent", () => ({ readAnalyticsConsent: (...args: unknown[]) => allowed(...args), readRequestAnalyticsState: jest.fn().mockResolvedValue(undefined), linkRequestAnalyticsSubject: jest.fn().mockResolvedValue(true) }));

beforeEach(() => {
	globalThis.__creatorAnalyticsMetrics = undefined;
	callbacks.length = 0;
	selectRows.mockReset();
	allowed.mockReset().mockResolvedValue(false);
	process.env.NEXT_PUBLIC_BASE_URL = "https://clipify.us";
	process.env.UMAMI_WEBSITE_ID = "cc971acc-716d-4056-a79c-3cfda9fb8e1d";
	delete process.env.E2E_TEST_MODE;
	global.fetch = jest.fn().mockResolvedValue({ ok: true });
});
it("counts rejected event deliveries without failing the business operation", async () => {
	allowed.mockResolvedValue(true);
	(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });
	const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
	await expect(sendServerProductEvent("private-account", "payment_verified", { revenue: 2 })).resolves.toBeUndefined();
	expect(getCreatorAnalyticsRuntimeMetrics()).toMatchObject({ deliveryAttempts: 1, deliveryFailed: 1, deliverySucceeded: 0 });
	expect(global.fetch).toHaveBeenCalledTimes(1);
	expect(warning).toHaveBeenCalled();
	expect(JSON.stringify(warning.mock.calls)).not.toContain("private-account");
	warning.mockRestore();
});

it("retries an explicitly rejected rate-limited event once and records recovery", async () => {
	allowed.mockResolvedValue(true);
	(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429, headers: new Headers({ "Retry-After": "0" }) }).mockResolvedValueOnce({ ok: true });
	await sendServerProductEvent("account", "resource_saved", {});
	expect(global.fetch).toHaveBeenCalledTimes(2);
	expect(getCreatorAnalyticsRuntimeMetrics()).toMatchObject({ deliveryAttempts: 2, deliveryRetries: 1, deliverySucceeded: 1, deliveryFailed: 0 });
});

it("honors withdrawal before retrying a rejected event", async () => {
	allowed.mockResolvedValueOnce(true).mockResolvedValue(false);
	(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 429, headers: new Headers({ "Retry-After": "0" }) });
	await sendServerProductEvent("account", "resource_saved", {});
	expect(global.fetch).toHaveBeenCalledTimes(1);
	expect(allowed).toHaveBeenCalledTimes(2);
});

it("stops retrying instead of tying up a response lifecycle for a long provider cooldown", async () => {
	allowed.mockResolvedValue(true);
	(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 429, headers: new Headers({ "Retry-After": "60" }) });
	const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
	await sendServerProductEvent("account", "resource_saved", {});
	expect(global.fetch).toHaveBeenCalledTimes(1);
	expect(getCreatorAnalyticsRuntimeMetrics()).toMatchObject({ deliveryFailed: 1, deliveryRetries: 0 });
	warning.mockRestore();
});
it("does not send optional server outcomes without authoritative statistics consent", async () => {
	await sendServerProductEvent("account", "payment_verified", { revenue: 2, currency: "EUR" });
	expect(global.fetch).not.toHaveBeenCalled();
});
it("uses native ingestion and native identity for a consented verified outcome", async () => {
	allowed.mockResolvedValue(true);
	await sendServerProductEvent("account", "payment_verified", { revenue: 2, currency: "EUR" });
	expect(global.fetch).toHaveBeenCalledWith("https://umami.cloud.thedannicraft.de/api/send", expect.objectContaining({ method: "POST", body: JSON.stringify({ type: "event", payload: { website: "cc971acc-716d-4056-a79c-3cfda9fb8e1d", hostname: "clipify.us", url: "/dashboard", id: "account", name: "payment_verified", tag: "server", data: { revenue: 2, currency: "EUR" } } }) }));
});
it("does not turn analytics failures into failed billing or resource operations", async () => {
	allowed.mockResolvedValue(true);
	(global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));
	await expect(sendServerProductEvent("account", "resource_saved", { resource_type: "overlay" })).resolves.toBeUndefined();
});

it("exports only committed audits and rechecks consent after the response", async () => {
	allowed.mockResolvedValue(true);
	selectRows.mockResolvedValue([]);
	trackCommittedProductEvent("account", "rolled-back-audit", "feature_used", { feature: "create_gallery" });
	await callbacks.pop()!();
	expect(global.fetch).not.toHaveBeenCalled();
	selectRows.mockResolvedValue([{ id: "committed-audit" }]);
	trackCommittedProductEvent("account", "committed-audit", "feature_used", { feature: "create_gallery" });
	allowed.mockResolvedValue(false);
	await callbacks.pop()!();
	expect(global.fetch).not.toHaveBeenCalled();
	allowed.mockResolvedValue(true);
	trackCommittedProductEvent("account", "committed-audit", "feature_used", { feature: "create_gallery" });
	await callbacks.pop()!();
	expect(global.fetch).toHaveBeenCalledTimes(1);
});

it("resolves the committed creator's verified auth link for background outcomes", async () => {
	allowed.mockResolvedValue(true);
	selectRows.mockResolvedValueOnce([{ id: "invoice-audit" }]).mockResolvedValueOnce([{ authUserId: "verified-auth-account" }]);
	trackCommittedCreatorOutcome("creator-domain-id", "invoice-audit", "payment_verified", { revenue: 20, currency: "EUR" });
	await callbacks.pop()!();
	expect(allowed).toHaveBeenCalledWith("verified-auth-account", undefined);
	expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).payload.id).toBe("verified-auth-account");
	expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).payload.data.outcome_id).toBe("invoice-audit");
});

it("never schedules collection in isolated E2E runs or for missing identities", () => {
	process.env.E2E_TEST_MODE = "true";
	process.env.NEXT_PUBLIC_BASE_URL = "https://beta-533.clipify.cloud.thedannicraft.de";
	trackServerProductEvent("account", "resource_saved", {});
	trackCommittedProductEvent("account", "audit", "resource_saved", {});
	trackCommittedCreatorOutcome("creator", "audit", "payment_verified", {});
	process.env.NEXT_PUBLIC_BASE_URL = "https://clipify.us";
	delete process.env.E2E_TEST_MODE;
	trackServerProductEvent("", "resource_saved", {});
	expect(callbacks).toHaveLength(0);
});

it("never uses a viewer's request consent to identify a creator for playback or billing", async () => {
	const { readRequestAnalyticsState, linkRequestAnalyticsSubject } = await import("@/server/analytics-consent");
	jest.mocked(readRequestAnalyticsState).mockResolvedValueOnce({ initialRecords: { subject: { subjectId: "viewer-subject" } } } as never);
	allowed.mockResolvedValue(false);
	selectRows.mockResolvedValueOnce([{ id: "playback" }]).mockResolvedValueOnce([{ authUserId: "creator-account" }]);
	const linksBefore = jest.mocked(linkRequestAnalyticsSubject).mock.calls.length;
	trackCommittedCreatorOutcome("creator-domain-id", "playback", "first_playback", {});
	await callbacks.pop()!();
	expect(jest.mocked(linkRequestAnalyticsSubject).mock.calls).toHaveLength(linksBefore);
	expect(allowed).toHaveBeenCalledWith("creator-account", undefined);
	expect(global.fetch).not.toHaveBeenCalled();
});

it("does not initialize optional request analytics outside a Next response lifecycle", async () => {
	const { readRequestAnalyticsState } = await import("@/server/analytics-consent");
	const before = jest.mocked(readRequestAnalyticsState).mock.calls.length;
	jest.spyOn(jest.requireMock("next/server"), "after").mockImplementationOnce(() => {
		throw new Error("offline lifecycle");
	});
	trackServerProductEvent("account", "resource_saved", {});
	await Promise.resolve();
	await Promise.resolve();
	expect(jest.mocked(readRequestAnalyticsState).mock.calls.length).toBe(before);
	jest.restoreAllMocks();
});

it("routes preview outcomes to the sandbox with the actual preview hostname", async () => {
	process.env.NEXT_PUBLIC_BASE_URL = "https://beta-533.clipify.cloud.thedannicraft.de";
	process.env.UMAMI_WEBSITE_ID = "b1e8f2fb-9b3e-4276-91f6-dfbce9455377";
	allowed.mockResolvedValue(true);
	trackServerProductEvent("account", "resource_saved", {});
	expect(callbacks).toHaveLength(1);
	await callbacks.pop()!();
	expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).payload).toMatchObject({ website: "b1e8f2fb-9b3e-4276-91f6-dfbce9455377", hostname: "beta-533.clipify.cloud.thedannicraft.de" });
});

it("queries the sandbox site's API for localhost", async () => {
	process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";
	process.env.UMAMI_WEBSITE_ID = "b1e8f2fb-9b3e-4276-91f6-dfbce9455377";
	process.env.UMAMI_API_KEY = "sandbox-test-key";
	(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ pageviews: 2 }) });
	await queryUmami("/stats", {});
	expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/websites/b1e8f2fb-9b3e-4276-91f6-dfbce9455377/stats"), expect.any(Object));
	delete process.env.UMAMI_API_KEY;
});

it("leaves collection disabled instead of falling back to production when the site ID is absent", async () => {
	delete process.env.UMAMI_WEBSITE_ID;
	allowed.mockResolvedValue(true);
	await sendServerProductEvent("account", "resource_saved", {});
	trackServerProductEvent("account", "resource_saved", {});
	trackCommittedProductEvent("account", "audit", "resource_saved", {});
	trackCommittedCreatorOutcome("creator", "audit", "payment_verified", {});
	expect(callbacks).toHaveLength(0);
	expect(global.fetch).not.toHaveBeenCalled();
	process.env.UMAMI_API_KEY = "test-key";
	await expect(queryUmami("/stats", {})).rejects.toThrow("UMAMI_WEBSITE_ID is not configured");
	delete process.env.UMAMI_API_KEY;
});
