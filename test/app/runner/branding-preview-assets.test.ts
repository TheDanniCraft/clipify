/** @jest-environment node */
const mockPrincipal = jest.fn();
const mockRunner = jest.fn();
const mockProfile = jest.fn();
const mockAsset = jest.fn();
jest.mock("@/auth/session-principal", () => ({ getVerifiedSessionPrincipal: () => mockPrincipal() }));
jest.mock("@/db/client", () => ({ db: { query: { runnersTable: { findFirst: (...args: unknown[]) => mockRunner(...args) }, runnerBrandingAssetsTable: { findFirst: (...args: unknown[]) => mockAsset(...args) } } } }));
jest.mock("@/server/runner/branding-profiles", () => ({ getRunnerBrandingProfileForPrincipal: (...args: unknown[]) => mockProfile(...args) }));
import { GET } from "@/app/runner/preview/[runnerId]/assets/[assetId]/route";
import { PgDialect } from "drizzle-orm/pg-core";
const runnerId = "11111111-1111-4111-8111-111111111111";
const assetId = "22222222-2222-4222-8222-222222222222";
const params = { params: Promise.resolve({ runnerId, assetId }) };
beforeEach(() => {
	jest.clearAllMocks();
	mockPrincipal.mockResolvedValue({ kind: "session", authUserId: "image-operator", sessionId: "image-session", organizationId: "image-organization", authenticatedAt: new Date(0) });
	mockRunner.mockResolvedValue({ ownerId: "image-owner" });
	mockProfile.mockResolvedValue({ success: true, profile: {} });
	mockAsset.mockResolvedValue(null);
});

test.each(["invalid Runner", "missing Runner", "denied permission", "invalid kind", "invalid asset", "missing asset"])("TDD-US4-CON013 U149 strength: %s stays opaque and cannot return image bytes", async (reason) => {
	let requestedRunner = runnerId;
	let requestedAsset = assetId;
	let query = "";
	if (reason === "invalid Runner") requestedRunner = "not-a-runner";
	if (reason === "missing Runner") mockRunner.mockResolvedValue(null);
	if (reason === "denied permission") mockProfile.mockResolvedValue({ success: false, code: "ACCESS_DENIED" });
	if (reason === "invalid kind") query = "?kind=html";
	if (reason === "invalid asset") requestedAsset = "not-an-asset";
	const response = await GET(new Request(`http://localhost/runner/preview/${requestedRunner}/assets/${requestedAsset}${query}`), { params: Promise.resolve({ runnerId: requestedRunner, assetId: requestedAsset }) });
	expect(response.status).toBe(404);
	expect(await response.text()).toBe("");
	if (reason !== "missing asset") expect(mockAsset).not.toHaveBeenCalled();
	if (reason === "invalid Runner" || reason === "missing Runner") expect(mockProfile).not.toHaveBeenCalled();
});

test("TDD-US4-CON013 U149 strength: explicit logo preview queries the authorized owner and logo kind", async () => {
	const bytes = Buffer.from([255, 216, 255, 224]);
	mockAsset.mockResolvedValue({ bytes, normalizedMime: "image/jpeg" });
	const response = await GET(new Request(`http://localhost/runner/preview/${runnerId}/assets/${assetId}?kind=logo`), params);
	expect(response.status).toBe(200);
	expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
	expect(response.headers.get("content-type")).toBe("image/jpeg");
	expect(new PgDialect().sqlToQuery(mockAsset.mock.calls[0][0].where).params).toEqual(["image-owner", assetId, "logo"]);
});

test("TDD-US4-CON013 U149 strength: unauthenticated preview image access reveals no Runner or asset", async () => {
	mockPrincipal.mockResolvedValue(null);
	const response = await GET(new Request(`http://localhost/runner/preview/${runnerId}/assets/${assetId}`), params);
	expect(response.status).toBe(404);
	expect(await response.text()).toBe("");
	expect(mockRunner).not.toHaveBeenCalled();
	expect(mockProfile).not.toHaveBeenCalled();
	expect(mockAsset).not.toHaveBeenCalled();
});

test("TDD-US4-CON013 U149 strength: an authorized preview returns only owned background bytes with private raster headers", async () => {
	const principal = { kind: "session", authUserId: "image-owner", sessionId: "image-session", organizationId: "image-organization", authenticatedAt: new Date(0) };
	const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	mockPrincipal.mockResolvedValue(principal);
	mockRunner.mockResolvedValue({ ownerId: "image-owner" });
	mockProfile.mockResolvedValue({ success: true, profile: {} });
	mockAsset.mockResolvedValue({ id: assetId, ownerId: "image-owner", kind: "background", bytes, normalizedMime: "image/png" });
	const response = await GET(new Request(`http://localhost/runner/preview/${runnerId}/assets/${assetId}`), params);
	expect(response.status).toBe(200);
	expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
	expect(response.headers.get("content-type")).toBe("image/png");
	expect(response.headers.get("x-content-type-options")).toBe("nosniff");
	expect(response.headers.get("cache-control")).toBe("private, max-age=600");
	expect(response.headers.get("vary")).toBe("Cookie");
	expect(mockProfile).toHaveBeenCalledWith(principal, { ownerId: "image-owner", runnerId });
	expect(new PgDialect().sqlToQuery(mockAsset.mock.calls[0][0].where).params).toEqual(["image-owner", assetId, "background"]);
});
