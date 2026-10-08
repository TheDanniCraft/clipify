/** @jest-environment node */
jest.mock("server-only", () => ({}));
const mockNativeAuthority = jest.fn();
const mockTrustedAuthority = jest.fn();
const mockDiscovery = jest.fn();
const mockSelect = jest.fn();
jest.mock("@/auth/authorize-operation", () => ({ authorizeCreatorOperation: (...args: unknown[]) => mockNativeAuthority(...args), authorizeTrustedCreatorOperation: (...args: unknown[]) => mockTrustedAuthority(...args), listAuthorizedCreatorOperations: (...args: unknown[]) => mockDiscovery(...args) }));
jest.mock("@/db/client", () => ({ db: { select: (...args: unknown[]) => mockSelect(...args) } }));
import { listOverlayRecords, readOverlayRecord } from "@/server/resources/overlay-reads";
import { listPlaylistRecords, readPlaylistRecord } from "@/server/resources/playlist-reads";

beforeEach(() => {
	jest.clearAllMocks();
	const decision = { allowed: true, creator: { id: "creator" } };
	mockNativeAuthority.mockResolvedValue(decision);
	mockTrustedAuthority.mockResolvedValue(decision);
	mockDiscovery.mockResolvedValue([decision]);
	const chain = { from: () => chain, where: () => chain, orderBy: () => chain, limit: () => chain, execute: async () => [{ id: "resource", ownerId: "creator" }] };
	mockSelect.mockReturnValue(chain);
});

test.each([
	["overlay list", listOverlayRecords, ["creator"]],
	["overlay lookup", readOverlayRecord, ["resource"]],
	["playlist list", listPlaylistRecords, []],
	["playlist lookup", readPlaylistRecord, ["resource"]],
] as const)("shared %s rejects missing explicit trusted identity without ambient session or SQL", async (_name, reader, args) => {
	await expect(Reflect.apply(reader, undefined, args)).rejects.toThrow("AUTHENTICATION_REQUIRED");
	expect(mockNativeAuthority).not.toHaveBeenCalled();
	expect(mockDiscovery).not.toHaveBeenCalled();
	expect(mockSelect).not.toHaveBeenCalled();
});
