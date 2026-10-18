/** @jest-environment node */
import { randomUUID } from "node:crypto";
import { flowProbe } from "../../../support/mcp/probe";
const mockPrincipal = jest.fn(),
	mockSharp = jest.fn(),
	mockInsert = jest.fn(),
	mockAuthorityCheck = jest.fn(),
	mockBenefits = jest.fn();
const principal = { kind: "session", authUserId: "asset-operator", sessionId: "asset-session", organizationId: "asset-org", authenticatedAt: new Date() };
const ownerId = "asset-owner",
	runnerId = randomUUID();
jest.mock("@/auth/session-principal", () => ({ getVerifiedSessionPrincipal: () => mockPrincipal() }));
jest.mock("@/db/client", () => ({ db: {} }));
jest.mock("@/server/runner/branding-profiles", () => ({ withOwnedRunner: async (_principal: unknown, _input: unknown, _permission: unknown, _client: unknown, run: (tx: unknown, authority: unknown) => Promise<unknown>) => run({ insert: mockInsert }, { creator: { id: ownerId, plan: "pro" }, assertAuthorityCurrent: mockAuthorityCheck }) }));
jest.mock("@/server/runner/capabilities", () => ({ ...jest.requireActual("@/server/runner/capabilities"), resolveRunnerBenefits: (...args: unknown[]) => mockBenefits(...args) }));
jest.mock("sharp", () => ({ __esModule: true, default: (...args: unknown[]) => mockSharp(...args) }));
jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));
beforeEach(() => {
	jest.clearAllMocks();
	mockBenefits.mockResolvedValue({ proAccess: true });
	mockPrincipal.mockResolvedValue(principal);
	mockSharp.mockReturnValue({ metadata: async () => ({ format: "svg", width: 16, height: 16 }) });
});

test("TDD-US4-CON013 U149 strength: fresh Free policy rejects image upload before decode even with a stale raw Pro plan", async () => {
	mockBenefits.mockResolvedValue({ proAccess: false });
	const { POST } = await import("@/app/api/runner/branding-assets/route");
	const { captureException } = await import("@sentry/nextjs");
	const response = await POST(new Request(`http://localhost/api/runner/branding-assets?ownerId=${ownerId}&runnerId=${runnerId}&kind=background`, { method: "POST", body: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) }));
	expect(response.status).toBe(403);
	expect(await response.json()).toMatchObject({ success: false, code: "FEATURE_RESTRICTED" });
	expect(mockSharp).not.toHaveBeenCalled();
	expect(mockInsert).not.toHaveBeenCalled();
	expect(captureException).not.toHaveBeenCalled();
});

test.each(["missing body", "empty file", "invalid kind"])("TDD-US4-CON013 U149 strength: %s returns validation without decoding, storage or error reporting", async (variant) => {
	const { POST } = await import("@/app/api/runner/branding-assets/route");
	const { captureException } = await import("@sentry/nextjs");
	const body = variant === "missing body" ? undefined : variant === "empty file" ? Buffer.alloc(0) : Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	const response = await POST(new Request(`http://localhost/api/runner/branding-assets?ownerId=${ownerId}&runnerId=${runnerId}&kind=${variant === "invalid kind" ? "unsafe" : "background"}`, { method: "POST", body }));
	expect(response.status).toBe(400);
	expect(await response.json()).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(mockSharp).not.toHaveBeenCalled();
	expect(mockInsert).not.toHaveBeenCalled();
	expect(captureException).not.toHaveBeenCalled();
});

test("TDD-US4-CON013 U149 strength: an interrupted body releases its reader and returns a normal retry message", async () => {
	const stream = new ReadableStream<Uint8Array>({
		pull(controller) {
			controller.error(new Error("PRIVATE_UPLOAD_TRANSPORT_FAILURE"));
		},
	});
	const init = { method: "POST", body: stream, duplex: "half" };
	const request = new Request(`http://localhost/api/runner/branding-assets?ownerId=${ownerId}&runnerId=${runnerId}&kind=background`, init);
	const { POST } = await import("@/app/api/runner/branding-assets/route");
	const { captureException } = await import("@sentry/nextjs");
	const response = await POST(request);
	expect(response.status).toBe(400);
	expect(await response.json()).toEqual({ success: false, code: "INVALID_INPUT", error: "The upload was interrupted. Please try again." });
	expect(request.body!.locked).toBe(false);
	expect(mockSharp).not.toHaveBeenCalled();
	expect(mockInsert).not.toHaveBeenCalled();
	expect(captureException).not.toHaveBeenCalled();
});

test("TDD-US4-CON013 U149 strength: normalization cannot introduce an asset above the stored byte limit", async () => {
	const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	mockSharp.mockReturnValue({ metadata: async () => ({ format: "png", width: 16, height: 16 }), rotate: () => ({ png: () => ({ toBuffer: async () => ({ data: Buffer.alloc(2097153), info: { format: "png", width: 16, height: 16 } }) }) }) });
	const { POST } = await import("@/app/api/runner/branding-assets/route");
	const response = await POST(new Request(`http://localhost/api/runner/branding-assets?ownerId=${ownerId}&runnerId=${runnerId}&kind=background`, { method: "POST", body: bytes }));
	expect(response.status).toBe(400);
	expect(await response.json()).toMatchObject({ success: false, code: "INVALID_INPUT", error: expect.stringContaining("normalized image") });
	expect(mockInsert).not.toHaveBeenCalled();
	expect(mockAuthorityCheck).not.toHaveBeenCalled();
});

test.each([
	{ width: 0, height: 16 },
	{ width: 16, height: 0 },
])("TDD-US4-CON013 U149 strength: invalid decoded dimensions %j cannot be encoded or stored", async (dimensions) => {
	const rotate = jest.fn();
	mockSharp.mockReturnValue({ metadata: async () => ({ format: "png", ...dimensions }), rotate });
	const { POST } = await import("@/app/api/runner/branding-assets/route");
	const response = await POST(new Request(`http://localhost/api/runner/branding-assets?ownerId=${ownerId}&runnerId=${runnerId}&kind=background`, { method: "POST", body: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) }));
	expect(response.status).toBe(400);
	expect(await response.json()).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(rotate).not.toHaveBeenCalled();
	expect(mockInsert).not.toHaveBeenCalled();
});

test("TDD-US4-OPT081 U121: storage failure returns a normal retryable response and reports no private cause", async () => {
	const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
	const privateFailure = new Error("STORAGE_FAILURE_WITH_PRIVATE_MARKER");
	mockSharp.mockReturnValue({ metadata: async () => ({ format: "png", width: 16, height: 16 }), rotate: () => ({ png: () => ({ toBuffer: async () => ({ data: bytes, info: { format: "png", width: 16, height: 16 } }) }) }) });
	mockInsert.mockImplementationOnce(() => {
		throw privateFailure;
	});
	const { POST } = await import("@/app/api/runner/branding-assets/route");
	const { captureException } = await import("@sentry/nextjs");
	const response = await POST(new Request(`http://localhost/api/runner/branding-assets?ownerId=${ownerId}&runnerId=${runnerId}&kind=background`, { method: "POST", body: bytes }));
	expect(response.status).toBe(503);
	expect(response.headers.get("cache-control")).toBe("private, no-store");
	expect(await response.json()).toEqual({ success: false, code: "SERVICE_UNAVAILABLE", error: "Could not upload the image. Your saved appearance is unchanged. Please try again." });
	expect(mockInsert).toHaveBeenCalledTimes(1);
	expect(mockAuthorityCheck).toHaveBeenCalledTimes(1);
	expect(captureException).toHaveBeenCalledTimes(1);
	const reported = jest.mocked(captureException).mock.calls[0][0];
	expect(reported).not.toBe(privateFailure);
	expect(reported).toMatchObject({ message: "Runner standby image storage failed" });
	expect(reported).not.toHaveProperty("cause");
});
test("TDD-US4-CON013 U149: SVG file magic is refused before invoking a raster decoder or asset write", async () => {
	const { POST } = await import("@/app/api/runner/branding-assets/route");
	const response = await POST(new Request(`http://localhost/api/runner/branding-assets?ownerId=${ownerId}&runnerId=${runnerId}&kind=background`, { method: "POST", headers: { "Content-Type": "image/png" }, body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>' }));
	expect(response.status).toBe(400);
	expect(await response.json()).toMatchObject({ success: false, code: "INVALID_INPUT", error: expect.any(String) });
	expect(mockSharp).not.toHaveBeenCalled();
	expect(mockInsert).not.toHaveBeenCalled();
	expect(mockAuthorityCheck).not.toHaveBeenCalled();
});

test("TDD-US4-CON013 U270 baseline: HTML disguised as a PNG never enters the decoder or storage", async () => {
	const { POST } = await import("@/app/api/runner/branding-assets/route");
	const response = await POST(new Request(`http://localhost/api/runner/branding-assets?ownerId=${ownerId}&runnerId=${runnerId}&kind=background`, { method: "POST", headers: { "Content-Type": "image/png" }, body: '<!doctype html><html><script>throw new Error("unsafe")</script></html>' }));
	expect(response.status).toBe(400);
	expect(await response.json()).toMatchObject({ success: false, code: "INVALID_INPUT", error: expect.any(String) });
	expect(mockSharp).not.toHaveBeenCalled();
	expect(mockInsert).not.toHaveBeenCalled();
	expect(mockAuthorityCheck).not.toHaveBeenCalled();
});

test.each(["format mismatch", "decode failure"])("TDD-US4-CON013 U149 baseline: recognized PNG magic still requires successful matching raster decode (%s)", async (variant) => {
	const metadata = jest.fn();
	if (variant === "decode failure") metadata.mockRejectedValue(new Error("CONTROLLED_INVALID_RASTER"));
	else metadata.mockResolvedValue({ format: "webp", width: 16, height: 16 });
	mockSharp.mockReturnValue({ metadata });
	const { POST } = await import("@/app/api/runner/branding-assets/route");
	const response = await POST(new Request(`http://localhost/api/runner/branding-assets?ownerId=${ownerId}&runnerId=${runnerId}&kind=background`, { method: "POST", body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]) }));
	expect(response.status).toBe(400);
	expect(await response.json()).toMatchObject({ success: false, code: "INVALID_INPUT", error: expect.any(String) });
	expect(mockSharp).toHaveBeenCalledTimes(1);
	expect(metadata).toHaveBeenCalledTimes(1);
	expect(mockInsert).not.toHaveBeenCalled();
	expect(mockAuthorityCheck).not.toHaveBeenCalled();
});
test("TDD-US4-CON013 U149 baseline: an unauthenticated upload cannot invoke decoding or storage", async () => {
	mockPrincipal.mockResolvedValue(null);
	const { POST } = await import("@/app/api/runner/branding-assets/route");
	const request = new Request(`http://localhost/api/runner/branding-assets?ownerId=${ownerId}&runnerId=${runnerId}&kind=background`, { method: "POST", body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) });
	const read = jest.spyOn(request.body!, "getReader");
	const response = await POST(request);
	expect(response.status).toBe(401);
	expect(await response.json()).toMatchObject({ success: false, code: "ACCESS_DENIED" });
	expect(response.headers.get("cache-control")).toBe("private, no-store");
	expect(read).not.toHaveBeenCalled();
	expect(mockSharp).not.toHaveBeenCalled();
	expect(mockInsert).not.toHaveBeenCalled();
});

test("TDD-US4-CON013 U271 baseline: a failed asset commit rolls back staged bytes and preserves the previous profile reference", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_asset_transaction_rollback");
	expect(result.initialized).toBe(true);
	expect(result.attemptFailed).toBe(true);
	expect(result.stagedAssetCount).toBe(2);
	expect(result.profileUnchanged).toBe(true);
	expect(result.revision).toBe(2);
	expect(result.backgroundAssetId).toBe(result.oldAssetId);
	expect(result.assets).toEqual([{ id: result.oldAssetId }]);
});

test("TDD-US4-CON013 U272 baseline: detached asset cleanup observes a committed replacement and never removes the old image before commit", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_asset_cleanup_after_commit");
	expect(result.initialized).toBe(true);
	expect(result.updated).toMatchObject({ success: true });
	expect(result.oldAssetPresentBeforeCommit).toBe(true);
	expect(result.visibleProfileOldBeforeCommit).toBe(true);
	expect(result.newProfileStagedBeforeCommit).toBe(true);
	expect(result.cleanupAfterCommit).toBe(true);
	expect(result.revision).toBe(3);
	expect(result.backgroundAssetId).toBe(result.newAssetId);
	expect(result.assets).toEqual([{ id: result.newAssetId }]);
});

test("TDD-US4-CON013 U272: post-commit cleanup failure preserves a successful saved appearance and retains old bytes safely", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_asset_cleanup_failure");
	expect(result.initialized).toBe(true);
	expect(result.cleanupAfterCommit).toBe(true);
	expect(result.cleanupThrew).toBe(false);
	expect(result.updated).toMatchObject({ success: true, profile: { revision: 3 } });
	expect(result.backgroundAssetId).toBe(result.newAssetId);
	expect(result.assets).toHaveLength(2);
	expect(result.assets).toContainEqual({ id: result.newAssetId });
});

test("TDD-US4-BND015 U166 baseline: a 2097151-byte image is accepted with normalized bytes stored", async () => {
	const bytes = Buffer.alloc(2097151);
	Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
	const normalized = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);
	const assetId = randomUUID();
	const values = jest.fn().mockReturnValue({ returning: async () => [{ id: assetId }] });
	mockInsert.mockReturnValue({ values });
	const png = jest.fn().mockReturnValue({ toBuffer: async () => ({ data: normalized, info: { format: "png", width: 16, height: 16 } }) });
	mockSharp.mockReturnValue({ metadata: async () => ({ format: "png", width: 16, height: 16 }), rotate: () => ({ png }) });
	const { POST } = await import("@/app/api/runner/branding-assets/route");
	const response = await POST(new Request(`http://localhost/api/runner/branding-assets?ownerId=${ownerId}&runnerId=${runnerId}&kind=background`, { method: "POST", body: bytes }));
	expect(response.status).toBe(201);
	expect(await response.json()).toEqual({ success: true, asset: { id: assetId, kind: "background" } });
	expect(mockSharp).toHaveBeenCalledWith(bytes, { limitInputPixels: 16000000, animated: false });
	expect(png).toHaveBeenCalledWith({ compressionLevel: 9 });
	expect(values).toHaveBeenCalledWith(expect.objectContaining({ ownerId, kind: "background", normalizedMime: "image/png", sizeBytes: normalized.length, width: 16, height: 16, bytes: normalized }));
	expect(mockAuthorityCheck).toHaveBeenCalledTimes(2);
});

test("TDD-US4-BND016 U167 baseline: a 2097152-byte image is accepted with normalized bytes stored", async () => {
	const bytes = Buffer.alloc(2097152);
	Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
	const normalized = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);
	const assetId = randomUUID();
	const values = jest.fn().mockReturnValue({ returning: async () => [{ id: assetId }] });
	mockInsert.mockReturnValue({ values });
	const png = jest.fn().mockReturnValue({ toBuffer: async () => ({ data: normalized, info: { format: "png", width: 16, height: 16 } }) });
	mockSharp.mockReturnValue({ metadata: async () => ({ format: "png", width: 16, height: 16 }), rotate: () => ({ png }) });
	const { POST } = await import("@/app/api/runner/branding-assets/route");
	const response = await POST(new Request(`http://localhost/api/runner/branding-assets?ownerId=${ownerId}&runnerId=${runnerId}&kind=background`, { method: "POST", body: bytes }));
	expect(response.status).toBe(201);
	expect(await response.json()).toEqual({ success: true, asset: { id: assetId, kind: "background" } });
	expect(mockSharp).toHaveBeenCalledWith(bytes, { limitInputPixels: 16000000, animated: false });
	expect(png).toHaveBeenCalledWith({ compressionLevel: 9 });
	expect(values).toHaveBeenCalledWith(expect.objectContaining({ ownerId, kind: "background", normalizedMime: "image/png", sizeBytes: normalized.length, width: 16, height: 16, bytes: normalized }));
	expect(mockAuthorityCheck).toHaveBeenCalledTimes(2);
});

test("TDD-US4-BND017 / TDD-US4-OPT079 / TDD-US4-EC012 U168 baseline: a 2097153-byte file is rejected before decoding or storage", async () => {
	const bytes = Buffer.alloc(2097153);
	Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
	const { POST } = await import("@/app/api/runner/branding-assets/route");
	const response = await POST(new Request(`http://localhost/api/runner/branding-assets?ownerId=${ownerId}&runnerId=${runnerId}&kind=background`, { method: "POST", body: bytes }));
	expect(response.status).toBe(413);
	expect(await response.json()).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(mockSharp).not.toHaveBeenCalled();
	expect(mockInsert).not.toHaveBeenCalled();
	expect(mockAuthorityCheck).not.toHaveBeenCalled();
});

async function expectRasterBoundary(width: number, height: number, accepted: boolean, format: "png" | "jpeg" | "webp" = "png") {
	const magic = format === "png" ? [137, 80, 78, 71, 13, 10, 26, 10, 0] : format === "jpeg" ? [255, 216, 255, 224, 0] : [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80, 0];
	const bytes = Buffer.from(magic);
	const assetId = randomUUID();
	const values = jest.fn().mockReturnValue({ returning: async () => [{ id: assetId }] });
	mockInsert.mockReturnValue({ values });
	const encode = jest.fn().mockReturnValue({ toBuffer: async () => ({ data: bytes, info: { format, width, height } }) });
	const rotate = jest.fn().mockReturnValue({ [format]: encode });
	mockSharp.mockReturnValue({ metadata: async () => ({ format, width, height }), rotate });
	const { POST } = await import("@/app/api/runner/branding-assets/route");
	const response = await POST(new Request(`http://localhost/api/runner/branding-assets?ownerId=${ownerId}&runnerId=${runnerId}&kind=background`, { method: "POST", body: bytes }));
	expect(mockSharp).toHaveBeenCalledWith(bytes, { limitInputPixels: 16000000, animated: false });
	if (accepted) {
		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ success: true, asset: { id: assetId, kind: "background" } });
		expect(rotate).toHaveBeenCalledTimes(1);
		expect(encode).toHaveBeenCalledWith(format === "png" ? { compressionLevel: 9 } : { quality: 90 });
		expect(values).toHaveBeenCalledWith(expect.objectContaining({ ownerId, kind: "background", normalizedMime: `image/${format}`, sizeBytes: bytes.length, width, height, bytes }));
		expect(mockAuthorityCheck).toHaveBeenCalledTimes(2);
	} else {
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ success: false, code: "INVALID_INPUT" });
		expect(rotate).not.toHaveBeenCalled();
		expect(mockInsert).not.toHaveBeenCalled();
		expect(mockAuthorityCheck).not.toHaveBeenCalled();
	}
}

test("TDD-US4-BND018 U169 baseline: 4096 by 1 decoded image is accepted", async () => {
	await expectRasterBoundary(4096, 1, true);
});

test("TDD-US4-BND019 U170 baseline: 4097 by 1 decoded image is rejected", async () => {
	await expectRasterBoundary(4097, 1, false);
});

test("TDD-US4-BND020 U171 baseline: 1 by 4096 decoded image is accepted", async () => {
	await expectRasterBoundary(1, 4096, true);
});

test("TDD-US4-BND021 U172 baseline: 1 by 4097 decoded image is rejected", async () => {
	await expectRasterBoundary(1, 4097, false);
});

test("TDD-US4-BND022 U173 baseline: 3999 by 4000 decoded image is accepted", async () => {
	await expectRasterBoundary(3999, 4000, true);
});

test("TDD-US4-BND023 U174 baseline: 4000 by 4000 decoded image is accepted", async () => {
	await expectRasterBoundary(4000, 4000, true);
});

test("TDD-US4-BND024 U175 baseline: 4001 by 4000 decoded image is rejected", async () => {
	await expectRasterBoundary(4001, 4000, false);
});

test("TDD-US4-BND025 U176 baseline: png image is accepted and normalized in its raster format", async () => {
	await expectRasterBoundary(16, 16, true, "png");
});

test("TDD-US4-BND026 U177 baseline: jpeg image is accepted and normalized in its raster format", async () => {
	await expectRasterBoundary(16, 16, true, "jpeg");
});

test("TDD-US4-BND027 U178 baseline: webp image is accepted and normalized in its raster format", async () => {
	await expectRasterBoundary(16, 16, true, "webp");
});

test("TDD-US4-BND028 / TDD-US4-OPT078 / TDD-US4-EC012 U179 baseline: svg file is rejected without storage", async () => {
	const { POST } = await import("@/app/api/runner/branding-assets/route");
	const response = await POST(new Request(`http://localhost/api/runner/branding-assets?ownerId=${ownerId}&runnerId=${runnerId}&kind=background`, { method: "POST", body: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>') }));
	expect(response.status).toBe(400);
	expect(await response.json()).toMatchObject({ success: false, code: "INVALID_INPUT", error: expect.any(String) });
	expect(mockSharp).not.toHaveBeenCalled();
	expect(mockInsert).not.toHaveBeenCalled();
	expect(mockAuthorityCheck).not.toHaveBeenCalled();
});

test("TDD-US4-BND029 U180 baseline: html file is rejected without storage", async () => {
	const { POST } = await import("@/app/api/runner/branding-assets/route");
	const response = await POST(new Request(`http://localhost/api/runner/branding-assets?ownerId=${ownerId}&runnerId=${runnerId}&kind=background`, { method: "POST", body: Buffer.from("<!doctype html><html><body>Invalid image</body></html>") }));
	expect(response.status).toBe(400);
	expect(await response.json()).toMatchObject({ success: false, code: "INVALID_INPUT", error: expect.any(String) });
	expect(mockSharp).not.toHaveBeenCalled();
	expect(mockInsert).not.toHaveBeenCalled();
	expect(mockAuthorityCheck).not.toHaveBeenCalled();
});

test("TDD-US4-BND030 / TDD-US4-OPT080 / TDD-US4-EC012 U181 baseline: unreadable file is rejected without storage", async () => {
	mockSharp.mockReturnValue({
		metadata: async () => {
			throw new Error("CONTROLLED_UNREADABLE_RASTER");
		},
	});
	const { POST } = await import("@/app/api/runner/branding-assets/route");
	const response = await POST(new Request(`http://localhost/api/runner/branding-assets?ownerId=${ownerId}&runnerId=${runnerId}&kind=background`, { method: "POST", body: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3]) }));
	expect(response.status).toBe(400);
	expect(await response.json()).toMatchObject({ success: false, code: "INVALID_INPUT", error: expect.any(String) });
	expect(mockSharp).toHaveBeenCalledTimes(1);
	expect(mockInsert).not.toHaveBeenCalled();
	expect(mockAuthorityCheck).not.toHaveBeenCalled();
});
