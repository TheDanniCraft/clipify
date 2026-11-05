/** @jest-environment node */
export {};
jest.mock("@/server/brand-font-render", () => ({ validateBrandFont: async () => {} }));
jest.mock("@/server/rate-limit", () => ({ consumeAppRateLimit: async () => ({ success: true }) }));
const authorize = jest.fn();
const execute = jest.fn();
const returning = jest.fn();
const insert = jest.fn();
const select = jest.fn();
const resolve = jest.fn();
jest.mock("@/auth/authorize-operation", () => ({ authorizeCreatorOperation: (...args: unknown[]) => authorize(...args) }));
jest.mock("@lib/entitlements", () => ({ resolveUserEntitlements: (...args: unknown[]) => resolve(...args) }));
jest.mock("@/db/client", () => ({ db: { select: (...args: unknown[]) => select(...args), insert: (...args: unknown[]) => insert(...args) } }));
beforeEach(() => {
	jest.clearAllMocks();
	authorize.mockResolvedValue({ allowed: true, creator: { id: "creator", avatar: "", plan: "free" } });
	resolve.mockResolvedValue({ proAccess: false });
	select.mockReturnValue({ from: () => ({ where: () => ({ limit: () => ({ execute }) }) }) });
	execute.mockResolvedValue([]);
	insert.mockReturnValue({ values: () => ({ onConflictDoUpdate: () => ({ returning }) }) });
	returning.mockResolvedValue([{ state: '{"revision":1}' }]);
});
it("saves a creator-owned brand with optimistic revision and rejects denied watermark removal", async () => {
	const api = await import("@actions/creatorBrand").catch(() => null);
	expect(api).not.toBeNull();
	if (!api) return;
	expect(await api.saveCreatorBrand("creator", { fontFamily: "Laila", fontSource: "google", watermark: true }, 0)).toMatchObject({ ok: true, revision: 1 });
	expect(await api.saveCreatorBrand("creator", { watermark: false }, 1)).toMatchObject({ ok: false, code: "PRO_REQUIRED" });
	expect(insert).toHaveBeenCalledTimes(1);
	returning.mockResolvedValue([]);
	expect(await api.saveCreatorBrand("creator", { watermark: true }, 0)).toMatchObject({ ok: false, code: "CONFLICT" });
});
it("reads the selected creator, refuses denied access before storage and preserves errors", async () => {
	const api = await import("@actions/creatorBrand").catch(() => null);
	expect(api).not.toBeNull();
	if (!api) return;
	expect(await api.getCreatorBrand("creator")).toMatchObject({ ok: true, brand: null, revision: 0, canRemoveWatermark: false });
	authorize.mockResolvedValue({ allowed: false, code: "PERMISSION_DENIED" });
	select.mockClear();
	expect(await api.getCreatorBrand("other")).toMatchObject({ ok: false, code: "PERMISSION_DENIED" });
	expect(select).not.toHaveBeenCalled();
});
it("rejects invalid input and denied writes without reading or saving another creator", async () => {
	const api = await import("@actions/creatorBrand");
	expect(await api.getCreatorBrand("")).toMatchObject({ code: "INVALID_INPUT" });
	for (const [id, brand, revision] of [
		["", {}, 0],
		["creator", { fontSource: "url" }, 0],
		["creator", {}, -1],
	] as const)
		expect(await api.saveCreatorBrand(id, brand, revision)).toMatchObject({ code: "INVALID_INPUT" });
	authorize.mockResolvedValue({ allowed: false, code: "PERMISSION_DENIED" });
	expect(await api.saveCreatorBrand("other", {}, 0)).toMatchObject({ code: "PERMISSION_DENIED" });
	expect(insert).not.toHaveBeenCalled();
});
it("keeps the stored brand and translates corrupt storage and write failures", async () => {
	const api = await import("@actions/creatorBrand");
	const { creatorBrandSchema } = await import("@lib/overlayMetadata");
	const brand = creatorBrandSchema.parse({ fontFamily: "Laila", fontSource: "google" });
	execute.mockResolvedValue([{ state: JSON.stringify({ brand, revision: 3 }) }]);
	expect(await api.getCreatorBrand("creator")).toMatchObject({ ok: true, brand, revision: 3 });
	expect(await api.saveCreatorBrand("creator", {}, 2)).toMatchObject({ code: "CONFLICT" });
	expect(await api.saveCreatorBrand("creator", {}, 3)).toMatchObject({ ok: true, revision: 4 });
	execute.mockResolvedValue([{ state: JSON.stringify({ brand, revision: 0 }) }]);
	expect(await api.getCreatorBrand("creator")).toMatchObject({ code: "SERVICE_UNAVAILABLE" });
	execute.mockRejectedValue(Error("database"));
	expect(await api.getCreatorBrand("creator")).toMatchObject({ code: "SERVICE_UNAVAILABLE" });
	returning.mockRejectedValue(Error("database"));
	expect(await api.saveCreatorBrand("creator", {}, 0)).toMatchObject({ code: "SERVICE_UNAVAILABLE" });
	resolve.mockResolvedValue({ proAccess: true });
	returning.mockResolvedValue([{}]);
	expect(await api.saveCreatorBrand("creator", { watermark: false }, 0)).toMatchObject({ ok: true, brand: { watermark: false } });
});
it("lists only authorized overlay style fields and handles missing service", async () => {
	const api = await import("@actions/creatorBrand");
	expect(await api.getBrandOverlaySources("")).toMatchObject({ code: "INVALID_INPUT" });
	expect(await api.getBrandOverlaySources("creator")).toMatchObject({ ok: true, overlays: [] });
	execute.mockRejectedValue(Error("database"));
	expect(await api.getBrandOverlaySources("creator")).toMatchObject({ code: "SERVICE_UNAVAILABLE" });
	authorize.mockResolvedValue({ allowed: false, code: "PERMISSION_DENIED" });
	expect(await api.getBrandOverlaySources("other")).toMatchObject({ code: "PERMISSION_DENIED" });
});
it("reports read-only collaborator access separately from creator branding visibility", async () => {
	const api = await import("@actions/creatorBrand");
	authorize.mockImplementation(async ({ permission }) => (permission === "creator:update" ? { allowed: false, code: "PERMISSION_DENIED" } : { allowed: true, accessPath: "direct", creator: { id: "creator", plan: "pro" } }));
	expect(await api.getCreatorBrand("creator")).toMatchObject({ ok: true, canEdit: false });
	authorize.mockResolvedValue({ allowed: true, accessPath: "owner", creator: { id: "creator", plan: "pro" } });
	expect(await api.getCreatorBrand("creator")).toMatchObject({ ok: true, canEdit: true });
});
