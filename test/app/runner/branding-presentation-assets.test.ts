/** @jest-environment node */
const mockCookie = jest.fn();
const mockIdentity = jest.fn();
const mockExecution = jest.fn();
const mockProfile = jest.fn();
const mockAsset = jest.fn();
jest.mock("next/headers", () => ({ cookies: async () => ({ get: mockCookie }) }));
jest.mock("@/db/client", () => ({ db: { query: { runnerBrandingAssetsTable: { findFirst: (...args: unknown[]) => mockAsset(...args) } } } }));
jest.mock("@/server/runner/presentation", () => ({ RUNNER_PRESENTATION_COOKIE: "clipify_runner_presentation", verifyRunnerPresentationIdentity: (...args: unknown[]) => mockIdentity(...args), resolveRunnerPresentationExecution: (...args: unknown[]) => mockExecution(...args) }));
jest.mock("@/server/runner/branding-profiles", () => ({ readRunnerBrandingProfileInternal: (...args: unknown[]) => mockProfile(...args) }));
import { GET } from "@/app/runner/presentation/[sessionId]/assets/[assetId]/route";
import { PgDialect } from "drizzle-orm/pg-core";
const sessionId = "11111111-1111-4111-8111-111111111111";
const assetId = "22222222-2222-4222-8222-222222222222";
const params = { params: Promise.resolve({ sessionId, assetId }) };
const runnerId = "33333333-3333-4333-8333-333333333333";
const identity = { sessionId, runnerId, ownerId: "presentation-owner", executionGeneration: "44444444-4444-4444-8444-444444444444" };
beforeEach(() => {
	jest.clearAllMocks();
	mockCookie.mockReturnValue({ value: "current-cookie" });
	mockIdentity.mockReturnValue(identity);
	mockExecution.mockResolvedValue({ session: { id: sessionId } });
	mockProfile.mockResolvedValue({ backgroundAssetId: assetId, logoAssetId: null });
	mockAsset.mockResolvedValue({ bytes: Buffer.from([1, 2, 3]), normalizedMime: "image/png" });
});

test.each(["background", "logo"])("TDD-US4-CON013 U149 strength: a current assigned %s image uses the verified owner and saved kind", async (kind) => {
	const bytes = Buffer.from([10, 20, 30]);
	mockProfile.mockResolvedValue({ backgroundAssetId: kind === "background" ? assetId : null, logoAssetId: kind === "logo" ? assetId : null });
	mockAsset.mockResolvedValue({ bytes, normalizedMime: "image/webp" });
	const response = await GET(new Request(`http://localhost/runner/presentation/${sessionId}/assets/${assetId}?kind=untrusted`), params);
	expect(response.status).toBe(200);
	expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
	expect(response.headers.get("content-type")).toBe("image/webp");
	expect(response.headers.get("x-content-type-options")).toBe("nosniff");
	expect(response.headers.get("cache-control")).toBe("private, max-age=600");
	expect(response.headers.get("vary")).toBe("Cookie");
	expect(mockExecution).toHaveBeenCalledWith(identity);
	expect(mockProfile).toHaveBeenCalledWith({ ownerId: identity.ownerId, runnerId });
	expect(new PgDialect().sqlToQuery(mockAsset.mock.calls[0][0].where).params).toEqual([identity.ownerId, assetId, kind]);
});

test.each(["missing cookie", "closed execution", "unassigned image", "missing image", "invalid image ID"])("TDD-US4-CON013 U149 strength: %s cannot retrieve presentation image bytes", async (reason) => {
	let requestedAsset = assetId;
	if (reason === "missing cookie") {
		mockCookie.mockReturnValue(undefined);
		mockIdentity.mockReturnValue(null);
	}
	if (reason === "closed execution") mockExecution.mockResolvedValue(null);
	if (reason === "unassigned image") mockProfile.mockResolvedValue({ backgroundAssetId: null, logoAssetId: null });
	if (reason === "missing image") mockAsset.mockResolvedValue(null);
	if (reason === "invalid image ID") {
		requestedAsset = "not-an-asset";
		mockProfile.mockResolvedValue({ backgroundAssetId: requestedAsset, logoAssetId: null });
	}
	const response = await GET(new Request(`http://localhost/runner/presentation/${sessionId}/assets/${requestedAsset}`), { params: Promise.resolve({ sessionId, assetId: requestedAsset }) });
	expect(response.status).toBe(404);
	expect(await response.text()).toBe("");
	if (reason !== "missing image") expect(mockAsset).not.toHaveBeenCalled();
	if (reason === "closed execution" || reason === "missing cookie") expect(mockProfile).not.toHaveBeenCalled();
	if (reason === "missing cookie") expect(mockIdentity).toHaveBeenCalledWith(undefined, sessionId);
});

test("TDD-US4-CON013 U149 strength: an invalid presentation identity cannot read profile or image bytes", async () => {
	mockCookie.mockReturnValue({ value: "untrusted-cookie" });
	mockIdentity.mockReturnValue(null);
	const response = await GET(new Request(`http://localhost/runner/presentation/${sessionId}/assets/${assetId}`), params);
	expect(response.status).toBe(404);
	expect(await response.text()).toBe("");
	expect(mockCookie).toHaveBeenCalledWith("clipify_runner_presentation");
	expect(mockIdentity).toHaveBeenCalledWith("untrusted-cookie", sessionId);
	expect(mockExecution).not.toHaveBeenCalled();
	expect(mockProfile).not.toHaveBeenCalled();
	expect(mockAsset).not.toHaveBeenCalled();
});
