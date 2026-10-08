/** @jest-environment node */
export {};
jest.mock("server-only", () => ({}));
const principalLookup = jest.fn();
const rows = jest.fn();
const reorder = jest.fn();
const selection = jest.fn();
jest.mock("@/auth/session-principal", () => ({ getVerifiedSessionPrincipal: (...args: unknown[]) => principalLookup(...args) }));
jest.mock("@/db/client", () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: () => rows() }) }) }) } }));
jest.mock("@/server/resources/playlists", () => ({ reorderPlaylistItems: (...args: unknown[]) => reorder(...args) }));
jest.mock("@/server/resources/playlist-items", () => ({ savePlaylistItemSelection: (...args: unknown[]) => selection(...args) }));
import { reorderBrowserPlaylist, saveBrowserPlaylistItems } from "@/server/resources/browser-playlists";
const principal = { kind: "session", authUserId: "actor", sessionId: "session", authenticatedAt: new Date(0) };
const row = { id: "playlist", ownerId: "creator" };
beforeEach(() => {
	jest.resetAllMocks();
	principalLookup.mockResolvedValue(principal);
	rows.mockResolvedValue([row]);
	reorder.mockResolvedValue({ configurationRevision: 8 });
	selection.mockResolvedValue({ configurationRevision: 8 });
});
const operations = [
	{ label: "reorder", call: (revision: number | undefined) => reorderBrowserPlaylist(row.id, ["item-a"], revision), writer: reorder },
	{ label: "selection", call: (revision: number | undefined) => saveBrowserPlaylistItems(row.id, ["clip-a"], "replace", revision), writer: selection },
];
describe.each(operations)("browser $label boundaries", ({ call, writer }) => {
	test.each([undefined, 0, -1, 1.5, Number.POSITIVE_INFINITY])("invalid revision %p cannot reach session or storage", async (revision) => {
		expect(await call(revision)).toBeNull();
		expect(principalLookup).not.toHaveBeenCalled();
		expect(rows).not.toHaveBeenCalled();
		expect(writer).not.toHaveBeenCalled();
	});
	test("absent session cannot reach resource storage", async () => {
		principalLookup.mockResolvedValue(null);
		expect(await call(7)).toBeNull();
		expect(rows).not.toHaveBeenCalled();
		expect(writer).not.toHaveBeenCalled();
	});
	test("missing resource cannot reach writer", async () => {
		rows.mockResolvedValue([]);
		expect(await call(7)).toBeNull();
		expect(writer).not.toHaveBeenCalled();
	});
	test.each(["session", "lookup", "writer"])("private %s failure produces only unavailable outcome", async (source) => {
		const failing = source === "session" ? principalLookup : source === "lookup" ? rows : writer;
		failing.mockRejectedValue(new Error("private fixture detail"));
		expect(await call(7)).toBeNull();
	});
});
test("reorder forwards verified principal, persisted owner and exact revision", async () => {
	const headers = new Headers();
	expect(await reorderBrowserPlaylist(row.id, ["item-b", "item-a"], 7, headers)).toEqual({ configurationRevision: 8 });
	expect(principalLookup).toHaveBeenCalledWith(headers);
	expect(reorder).toHaveBeenCalledWith(principal, { creatorId: row.ownerId, playlistId: row.id, itemIds: ["item-b", "item-a"], expectedRevision: 7 });
});
test.each([undefined, "Renamed"])("selection forwards optional name %p and backend Pro requirement", async (name) => {
	const headers = new Headers();
	expect(await saveBrowserPlaylistItems(row.id, ["clip-a"], "append", 7, name, headers, true)).toEqual({ configurationRevision: 8 });
	expect(principalLookup).toHaveBeenCalledWith(headers);
	expect(selection).toHaveBeenCalledWith(principal, { creatorId: row.ownerId, playlistId: row.id, clipIds: ["clip-a"], mode: "append", expectedRevision: 7, requirePro: true, ...(name === undefined ? {} : { name }) });
});
