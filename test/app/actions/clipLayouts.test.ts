/** @jest-environment node */
import { loadClipLayout, saveClipLayout } from "@actions/clipLayouts";
import { defaultClipLayout } from "@lib/clipLayout";
const authorize = jest.fn(),
	execute = jest.fn(),
	insert = jest.fn();
jest.mock("@/auth/authorize-operation", () => ({ authorizeCreatorOperation: (...args: unknown[]) => authorize(...args) }));
jest.mock("@/db/client", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ execute }) }) }),
		insert: (...args: unknown[]) => {
			insert(...args);
			return { values: () => ({ onConflictDoUpdate: () => ({ execute }) }) };
		},
	},
}));
beforeEach(() => {
	jest.clearAllMocks();
	authorize.mockResolvedValue({ allowed: true });
	execute.mockResolvedValue([]);
});
it("does not read or write presets without creator permission", async () => {
	authorize.mockResolvedValue({ allowed: false, code: "PERMISSION_DENIED" });
	expect(await loadClipLayout("foreign")).toMatchObject({ ok: false });
	expect(await saveClipLayout("foreign", defaultClipLayout)).toMatchObject({ ok: false });
	expect(execute).not.toHaveBeenCalled();
	expect(insert).not.toHaveBeenCalled();
});
it("rejects malformed layouts and creator inputs before writing", async () => {
	for (const id of ["", 3, "x".repeat(201)]) expect(await saveClipLayout(id as string, defaultClipLayout)).toMatchObject({ ok: false });
	expect(await saveClipLayout("owner", { ...defaultClipLayout, cameraShare: Infinity })).toMatchObject({ ok: false });
	expect(insert).not.toHaveBeenCalled();
});
it("loads validated presets and discards stale layout versions", async () => {
	execute.mockResolvedValueOnce([{ state: JSON.stringify(defaultClipLayout) }]).mockResolvedValueOnce([{ state: '{"version":0}' }]);
	expect(await loadClipLayout("owner")).toEqual({ ok: true, layout: defaultClipLayout });
	expect(await loadClipLayout("owner")).toEqual({ ok: true, layout: null });
});
it("saves only validated layouts and preserves failures as action results", async () => {
	expect(await saveClipLayout("owner", defaultClipLayout)).toEqual({ ok: true });
	expect(authorize).toHaveBeenCalledWith(expect.objectContaining({ permission: "creator:update" }));
	execute.mockRejectedValue(new Error("private"));
	expect(await saveClipLayout("owner", defaultClipLayout)).toEqual({ ok: false, code: "SERVICE_UNAVAILABLE" });
	expect(await loadClipLayout("owner")).toEqual({ ok: false, code: "SERVICE_UNAVAILABLE" });
});
it("rejects invalid preset reads and reports corrupt storage without exposing it", async () => {
	for (const id of ["", 4, "x".repeat(201)]) expect(await loadClipLayout(id as string)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(execute).not.toHaveBeenCalled();
	execute.mockResolvedValueOnce([{ state: "broken" }]);
	expect(await loadClipLayout("owner")).toEqual({ ok: false, code: "SERVICE_UNAVAILABLE" });
});
