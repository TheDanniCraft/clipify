/** @jest-environment node */
import { assertConnectedAppGrant } from "@/server/connected-apps/grants";

const now = new Date("2026-11-15T12:00:00Z");
const grant = { id: "g", clientId: "client", creatorId: "creator", operations: ["search_clips"], expiresAt: new Date(now.getTime() + 1), revokedAt: null, clientDisabled: false, creatorDisabled: false, creatorStatus: "active" };

it("denies a different creator even with an otherwise active application grant", () => {
	expect(() => assertConnectedAppGrant(grant, { clientId: "client", creatorId: "foreign", operation: "search_clips" }, now)).toThrow("ACCESS_DENIED");
});
it("allows the exact active creator, client and operation before expiry", () => {
	expect(() => assertConnectedAppGrant(grant, { clientId: "client", creatorId: "creator", operation: "search_clips" }, now)).not.toThrow();
});
it.each([{ expiresAt: now }, { expiresAt: new Date(now.getTime() - 1) }, { revokedAt: now }, { clientDisabled: true }, { creatorDisabled: true }, { creatorStatus: "suspended" }, { operations: [] }, { clientId: "other" }])("denies an unavailable application grant: %j", (change) => {
	expect(() => assertConnectedAppGrant({ ...grant, ...change }, { clientId: "client", creatorId: "creator", operation: "search_clips" }, now)).toThrow("ACCESS_DENIED");
});
it("denies missing grants and unsupported operations", () => {
	expect(() => assertConnectedAppGrant(undefined, { clientId: "client", creatorId: "creator", operation: "search_clips" }, now)).toThrow("ACCESS_DENIED");
	expect(() => assertConnectedAppGrant(grant, { clientId: "client", creatorId: "creator", operation: "delete_creator" }, now)).toThrow("ACCESS_DENIED");
});
it.each(["resolve_clip", "get_clip_playback"])("requires an explicit grant for reusable clip read operation %s", (operation) => {
	expect(() => assertConnectedAppGrant(grant, { clientId: "client", creatorId: "creator", operation }, now)).toThrow("ACCESS_DENIED");
	expect(() => assertConnectedAppGrant({ ...grant, operations: [operation] }, { clientId: "client", creatorId: "creator", operation }, now)).not.toThrow();
});
it("allows category discovery through an existing clip-search grant", () => {
	expect(() => assertConnectedAppGrant(grant, { clientId: "client", creatorId: "creator", operation: "search_categories" }, now)).not.toThrow();
});
it("denies category discovery without the clip-search grant", () => {
	expect(() => assertConnectedAppGrant({ ...grant, operations: ["resolve_clip"] }, { clientId: "client", creatorId: "creator", operation: "search_categories" }, now)).toThrow("ACCESS_DENIED");
});
