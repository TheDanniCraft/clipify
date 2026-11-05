jest.mock("@actions/twitch", () => ({ getGamesDetailsBulk: jest.fn(async () => []), getGameDetails: jest.fn(async () => null) }));
/** @jest-environment node */
import { readCreatorClipDetail } from "@/server/creator-library";
const authorize = jest.fn();
const execute = jest.fn();
const select = jest.fn(() => ({ from: () => ({ where: () => ({ execute }) }) }));
jest.mock("@/auth/authorize-operation", () => ({ authorizeCreatorOperation: (...args: unknown[]) => authorize(...args) }));
jest.mock("@/db/client", () => ({ db: { select: () => select() } }));
const clip = { id: "A", title: "Winning round", broadcaster_id: "owner", duration: 12, created_at: "2026-11-01T12:00:00Z", game_id: "game", creator_name: "Viewer" };
beforeEach(() => {
	jest.clearAllMocks();
	authorize.mockResolvedValue({ allowed: true });
	execute.mockReset();
});
it("denies access before reading any cached clip metadata", async () => {
	authorize.mockResolvedValue({ allowed: false, code: "PERMISSION_DENIED" });
	expect(await readCreatorClipDetail("foreign", "A")).toEqual({ ok: false, code: "PERMISSION_DENIED" });
	expect(select).not.toHaveBeenCalled();
});
it("returns owned normalized metadata and category without private cache fields", async () => {
	execute.mockResolvedValueOnce([{ value: JSON.stringify({ clip, privateToken: "secret" }), fetchedAt: new Date("2026-11-02T00:00:00Z") }]).mockResolvedValueOnce([{ value: JSON.stringify({ name: "Game" }) }]);
	const result = await readCreatorClipDetail("owner", "A");
	expect(result).toMatchObject({ ok: true, clip: { id: "A", title: "Winning round", clipCreatorName: "Viewer" }, categoryName: "Game", fetchedAt: "2026-11-02T00:00:00.000Z" });
	expect(JSON.stringify(result)).not.toContain("secret");
});
it.each([{ ...clip, broadcaster_id: "foreign" }, { ...clip, id: "B" }, { id: "A" }])("rejects mismatched or invalid cached data %#", async (value) => {
	execute.mockResolvedValue([{ value: JSON.stringify({ clip: value }), fetchedAt: new Date() }]);
	expect(await readCreatorClipDetail("owner", "A")).toEqual({ ok: false, code: "NOT_FOUND" });
});
it("handles missing and failed cache reads", async () => {
	execute.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("private database failure"));
	expect(await readCreatorClipDetail("owner", "A")).toEqual({ ok: false, code: "NOT_FOUND" });
	expect(await readCreatorClipDetail("owner", "A")).toEqual({ ok: false, code: "SERVICE_UNAVAILABLE" });
});
it("keeps clips without category metadata readable", async () => {
	execute.mockResolvedValue([{ value: JSON.stringify({ ...clip, game_id: undefined }), fetchedAt: new Date() }]);
	expect(await readCreatorClipDetail("owner", "A")).toMatchObject({ ok: true, categoryName: null });
	expect(execute).toHaveBeenCalledTimes(1);
});
it.each([JSON.stringify({ clip, unavailable: true }), "malformed-json"])("refuses tombstones and corrupt records", async (value) => {
	execute.mockResolvedValue([{ value, fetchedAt: new Date() }]);
	expect((await readCreatorClipDetail("owner", "A")).ok).toBe(false);
});
it.each([{ games: [] }, { games: [{ value: JSON.stringify({ name: 7 }) }] }])("tolerates missing category records %#", async ({ games }) => {
	execute.mockResolvedValueOnce([{ value: JSON.stringify({ clip }), fetchedAt: new Date() }]).mockResolvedValueOnce(games);
	expect(await readCreatorClipDetail("owner", "A")).toMatchObject({ ok: true, categoryName: null });
});
