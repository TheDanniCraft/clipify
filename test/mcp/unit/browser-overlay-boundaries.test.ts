/** @jest-environment node */
export {};
jest.mock("server-only", () => ({}));
const identity = jest.fn(),
	rows = jest.fn(),
	update = jest.fn(),
	remove = jest.fn(),
	volume = jest.fn();
jest.mock("@/auth/session-principal", () => ({ getVerifiedSessionPrincipal: (...args: unknown[]) => identity(...args) }));
jest.mock("@/db/client", () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: () => rows() }) }) }) } }));
jest.mock("@/server/resources/overlays", () => ({ updateOverlayRecord: (...args: unknown[]) => update(...args), deleteOverlay: (...args: unknown[]) => remove(...args), updateOwnerOverlayVolume: (...args: unknown[]) => volume(...args) }));
import { saveBrowserOverlay, deleteBrowserOverlay, setBrowserOverlayVolume } from "@/server/resources/browser-overlays";
const principal = { kind: "session", authUserId: "actor", sessionId: "session", authenticatedAt: new Date(0) };
const row = { id: "overlay", ownerId: "creator", name: "Existing", playerVolume: 83 };
beforeEach(() => {
	jest.resetAllMocks();
	identity.mockResolvedValue(principal);
	rows.mockResolvedValue([row]);
	update.mockResolvedValue({ ...row, configurationRevision: 8 });
	remove.mockResolvedValue({ deletedId: row.id });
	volume.mockResolvedValue(40);
});
const operations = [
	{ label: "save", call: (revision: number | undefined) => saveBrowserOverlay(row.id, { name: "Changed" }, revision), unavailable: null, writer: update },
	{ label: "delete", call: (revision: number | undefined) => deleteBrowserOverlay(row.id, revision), unavailable: false, writer: remove },
];
describe.each(operations)("browser overlay $label boundaries", ({ call, unavailable, writer }) => {
	test.each([undefined, 0, -1, 1.5, Number.POSITIVE_INFINITY])("invalid revision %p does not reach identity or persistence", async (revision) => {
		expect(await call(revision)).toBe(unavailable);
		expect(identity).not.toHaveBeenCalled();
		expect(rows).not.toHaveBeenCalled();
		expect(writer).not.toHaveBeenCalled();
	});
	test("absent session cannot read storage", async () => {
		identity.mockResolvedValue(null);
		expect(await call(7)).toBe(unavailable);
		expect(rows).not.toHaveBeenCalled();
	});
	test("absent resource cannot reach writer", async () => {
		rows.mockResolvedValue([]);
		expect(await call(7)).toBe(unavailable);
		expect(writer).not.toHaveBeenCalled();
	});
	test.each(["identity", "lookup", "writer"])("private %s failure remains unavailable", async (source) => {
		(source === "identity" ? identity : source === "lookup" ? rows : writer).mockRejectedValue(new Error("private fixture detail"));
		expect(await call(7)).toBe(unavailable);
	});
});
test("invalid private patch is rejected before the common writer", async () => {
	expect(await saveBrowserOverlay(row.id, { secret: "forged" }, 7)).toBeNull();
	expect(update).not.toHaveBeenCalled();
});
test("unchanged full snapshot sends only fallback name with its exact revision", async () => {
	await saveBrowserOverlay(row.id, { name: row.name, playerVolume: 83 }, 7);
	expect(update).toHaveBeenCalledWith(principal, { creatorId: row.ownerId, overlayId: row.id, patch: { name: row.name }, expectedRevision: 7 });
});
test("changed snapshot sends only actual changes and verified identity", async () => {
	const headers = new Headers();
	await saveBrowserOverlay(row.id, { name: "Changed", playerVolume: 83 }, 7, headers);
	expect(identity).toHaveBeenCalledWith(headers);
	expect(update).toHaveBeenCalledWith(principal, { creatorId: row.ownerId, overlayId: row.id, patch: { name: "Changed" }, expectedRevision: 7 });
});
test("deletion reports success only for the requested resource", async () => {
	expect(await deleteBrowserOverlay(row.id, 7)).toBe(true);
	remove.mockResolvedValue({ deletedId: "other" });
	expect(await deleteBrowserOverlay(row.id, 7)).toBe(false);
});
test("volume delegates current session and target owner", async () => {
	const headers = new Headers();
	expect(await setBrowserOverlayVolume(row.ownerId, 40, headers)).toBe(40);
	expect(identity).toHaveBeenCalledWith(headers);
	expect(volume).toHaveBeenCalledWith(principal, row.ownerId, 40);
});
test("absent session cannot update owner volume", async () => {
	identity.mockResolvedValue(null);
	expect(await setBrowserOverlayVolume(row.ownerId, 40)).toBeNull();
	expect(volume).not.toHaveBeenCalled();
});
test.each(["identity", "writer"])("private volume %s failure remains unavailable", async (source) => {
	(source === "identity" ? identity : volume).mockRejectedValue(new Error("private fixture detail"));
	expect(await setBrowserOverlayVolume(row.ownerId, 40)).toBeNull();
});
