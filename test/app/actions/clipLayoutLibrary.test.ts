/** @jest-environment node */
import { saveClipLayoutTemplate, saveClipLayoutOverride, listClipLayouts, setDefaultClipLayout, loadClipLayoutOverride, resetClipLayoutOverride, deleteClipLayoutTemplate } from "@actions/clipLayoutLibrary";
import { createClipComposition } from "@lib/clipComposition";
const authorize = jest.fn(),
	read = jest.fn(),
	write = jest.fn(),
	detail = jest.fn(),
	remove = jest.fn();
jest.mock("@/auth/authorize-operation", () => ({ authorizeCreatorOperation: (...args: unknown[]) => authorize(...args) }));
jest.mock("@actions/creatorLibrary", () => ({ getCreatorClipDetail: (...args: unknown[]) => detail(...args) }));
jest.mock("@/db/client", () => ({
	db: {
		delete: () => ({ where: () => ({ execute: remove }) }),
		select: () => ({ from: () => ({ where: () => ({ execute: read }) }) }),
		insert: () => ({
			values: (value: unknown) => {
				write(value);
				return { onConflictDoUpdate: () => ({ execute: async () => [] }) };
			},
		}),
	},
}));
beforeEach(() => {
	jest.clearAllMocks();
	authorize.mockResolvedValue({ allowed: true });
	read.mockResolvedValue([]);
	detail.mockResolvedValue({ ok: true, clip: { id: "clip" } });
});
it("stores named templates and clip overrides separately without mutating a template", async () => {
	const composition = createClipComposition("desktop");
	const saved = await saveClipLayoutTemplate("owner", { name: "Main desktop", composition });
	expect(saved.ok).toBe(true);
	if (!saved.ok) return;
	read.mockResolvedValue([{ contentKey: `clip-layout-template:v2:${saved.id}`, state: JSON.stringify({ name: "Main desktop", composition }), updatedAt: new Date() }]);
	const override = { ...composition, layers: composition.layers.map((layer) => ({ ...layer, frame: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 } })) };
	expect(await saveClipLayoutOverride("owner", saved.id, "clip", override)).toEqual({ ok: true });
	const [template, clip] = write.mock.calls.map((call) => call[0]);
	expect(template.contentKey).not.toBe(clip.contentKey);
	expect(JSON.parse(template.state).composition.layers[0].frame.w).toBe(1);
	expect(JSON.parse(clip.state).composition.layers[0].frame.w).toBe(0.8);
	expect(clip.userId).toBe("owner");
});
it("denies global and clip changes before any read/write when permissions are absent", async () => {
	authorize.mockResolvedValue({ allowed: false, code: "PERMISSION_DENIED" });
	const composition = createClipComposition("mobile");
	expect(await saveClipLayoutTemplate("foreign", { name: "Test", composition })).toMatchObject({ ok: false, code: "PERMISSION_DENIED" });
	expect(await saveClipLayoutOverride("foreign", "layout", "clip", composition)).toMatchObject({ ok: false, code: "PERMISSION_DENIED" });
	expect(read).not.toHaveBeenCalled();
	expect(write).not.toHaveBeenCalled();
});
it("keeps template orientation stable so existing clip overrides cannot silently change format", async () => {
	const composition = createClipComposition("desktop");
	read.mockResolvedValue([{ contentKey: "clip-layout-template:v2:layout", state: JSON.stringify({ name: "Desktop", composition }), updatedAt: new Date() }]);
	expect(await saveClipLayoutTemplate("owner", { id: "layout", name: "Desktop", composition: createClipComposition("mobile") })).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(write).not.toHaveBeenCalled();
});

it("lists named layouts, preserves format defaults and ignores stale default references", async () => {
	const composition = createClipComposition("mobile");
	read.mockResolvedValue([
		{ contentKey: "clip-layout-template:v2:layout", state: JSON.stringify({ name: "Camera", composition }), updatedAt: new Date("2026-11-05T00:00:00Z") },
		{ contentKey: "clip-layout-default:v2:mobile", state: JSON.stringify({ id: "layout" }) },
		{ contentKey: "clip-layout-default:v2:desktop", state: JSON.stringify({ id: "missing" }) },
	]);
	expect(await listClipLayouts("owner")).toMatchObject({ ok: true, templates: [{ id: "layout", name: "Camera" }], defaults: { mobile: "layout" } });
});
it("sets a default only for an existing template and never writes a foreign creator", async () => {
	expect(await setDefaultClipLayout("owner", "missing")).toMatchObject({ ok: false, code: "NOT_FOUND" });
	const composition = createClipComposition("desktop");
	read.mockResolvedValue([{ contentKey: "clip-layout-template:v2:layout", state: JSON.stringify({ name: "Desktop", composition }) }]);
	expect(await setDefaultClipLayout("owner", "layout")).toEqual({ ok: true });
	expect(write).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner", contentKey: "clip-layout-default:v2:desktop", state: JSON.stringify({ id: "layout" }) }));
});
it("loads and resets clip overrides only after checking the clip belongs to the creator", async () => {
	detail.mockResolvedValueOnce({ ok: false, code: "NOT_FOUND" });
	expect(await loadClipLayoutOverride("owner", "layout", "clip")).toMatchObject({ ok: false, code: "NOT_FOUND" });
	expect(read).not.toHaveBeenCalled();
	const composition = createClipComposition("mobile");
	read.mockResolvedValueOnce([{ contentKey: "clip-layout-template:v2:layout", state: JSON.stringify({ name: "Mobile", composition }) }]).mockResolvedValueOnce([{ state: JSON.stringify({ composition }) }]);
	expect(await loadClipLayoutOverride("owner", "layout", "clip")).toMatchObject({ ok: true, composition });
	read.mockResolvedValue([{ contentKey: "clip-layout-template:v2:layout", state: JSON.stringify({ name: "Mobile", composition }) }]);
	expect(await resetClipLayoutOverride("owner", "layout", "clip")).toEqual({ ok: true });
	expect(remove).toHaveBeenCalledTimes(1);
	expect(await deleteClipLayoutTemplate("owner", "layout")).toEqual({ ok: true });
	expect(remove).toHaveBeenCalledTimes(2);
});
it("rejects malformed identifiers and layouts at every mutation boundary", async () => {
	const composition = createClipComposition("desktop");
	expect(await listClipLayouts("")).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(await saveClipLayoutTemplate("owner", { name: "", composition })).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(await setDefaultClipLayout("owner", "../foreign")).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(await deleteClipLayoutTemplate("", "layout")).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(await loadClipLayoutOverride("owner", "layout", "../clip")).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(await resetClipLayoutOverride("owner", "layout", "")).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(await saveClipLayoutOverride("owner", "layout", "clip", {})).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(authorize).not.toHaveBeenCalled();
	expect(write).not.toHaveBeenCalled();
});
it("denies reads, defaults, deletion and resets before storage when access is revoked", async () => {
	authorize.mockResolvedValue({ allowed: false, code: "PERMISSION_DENIED" });
	for (const result of [await listClipLayouts("owner"), await setDefaultClipLayout("owner", "layout"), await deleteClipLayoutTemplate("owner", "layout"), await loadClipLayoutOverride("owner", "layout", "clip"), await resetClipLayoutOverride("owner", "layout", "clip")]) expect(result).toMatchObject({ ok: false, code: "PERMISSION_DENIED" });
	expect(read).not.toHaveBeenCalled();
	expect(remove).not.toHaveBeenCalled();
});
it("imports a legacy layout without writing or changing its source record", async () => {
	const { defaultClipLayout } = await import("@lib/clipLayout");
	read.mockResolvedValue([{ contentKey: "clip-portrait-layout:v1", state: JSON.stringify(defaultClipLayout), updatedAt: new Date("2026-11-05T00:00:00Z") }]);
	expect(await listClipLayouts("owner")).toMatchObject({ ok: true, templates: [{ id: "legacy", composition: { version: 2, format: "mobile" } }], defaults: { mobile: "legacy" } });
	expect(write).not.toHaveBeenCalled();
	expect(await setDefaultClipLayout("owner", "legacy")).toEqual({ ok: true });
});
it("returns typed storage failures without leaking database details", async () => {
	read.mockRejectedValue(Error("secret database connection"));
	for (const result of [await listClipLayouts("owner"), await setDefaultClipLayout("owner", "layout"), await loadClipLayoutOverride("owner", "layout", "clip"), await resetClipLayoutOverride("owner", "layout", "clip")]) expect(result).toEqual({ ok: false, code: "SERVICE_UNAVAILABLE" });
	write.mockImplementationOnce(() => {
		throw Error("secret storage");
	});
	expect(await saveClipLayoutTemplate("owner", { name: "Main", composition: createClipComposition("desktop") })).toEqual({ ok: false, code: "SERVICE_UNAVAILABLE" });
});
it("renames a global template without changing its identity and rejects incompatible clip formats", async () => {
	const composition = createClipComposition("desktop");
	read.mockResolvedValue([{ contentKey: "clip-layout-template:v2:layout", state: JSON.stringify({ name: "Old", composition }) }]);
	expect(await saveClipLayoutTemplate("owner", { id: "layout", name: "Renamed", composition })).toEqual({ ok: true, id: "layout" });
	expect(write.mock.calls[0][0].contentKey).toBe("clip-layout-template:v2:layout");
	expect(JSON.parse(write.mock.calls[0][0].state)).toEqual({ name: "Renamed", composition });
	write.mockClear();
	expect(await saveClipLayoutOverride("owner", "layout", "clip", createClipComposition("mobile"))).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(write).not.toHaveBeenCalled();
	read.mockResolvedValue([]);
	expect(await loadClipLayoutOverride("owner", "missing", "clip")).toMatchObject({ ok: false, code: "NOT_FOUND" });
});
it("preserves a stale editor draft instead of recreating a deleted global template", async () => {
	expect(await saveClipLayoutTemplate("owner", { id: "deleted", name: "Old draft", composition: createClipComposition("desktop") })).toMatchObject({ ok: false, code: "NOT_FOUND" });
	expect(write).not.toHaveBeenCalled();
});
