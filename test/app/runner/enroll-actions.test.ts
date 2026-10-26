/** @jest-environment node */
const mockFindEnrollment = jest.fn();
const mockFindRunner = jest.fn();
const mockFindRunners = jest.fn();
const mockFindOwners = jest.fn().mockResolvedValue([{ id: "free-owner", username: "Free creator", avatar: "" }]);
const mockListCreators = jest.fn(async (input: { requiredEntitlement?: string }) => (input.requiredEntitlement ? [] : [{ creator: { id: "free-owner" } }]));
const mockSet = jest.fn();
const mockWhere = jest.fn().mockResolvedValue(undefined);
const mockAuthorize = jest.fn(async (input: { creatorId: string; requiredEntitlement?: string }) => (input.requiredEntitlement ? { allowed: false, code: "ENTITLEMENT_REQUIRED" } : { allowed: true }));
const builder = { set: mockSet, where: mockWhere };
mockSet.mockReturnValue(builder);
jest.mock("@/db/client", () => ({ db: { query: { runnerEnrollmentsTable: { findFirst: (...args: unknown[]) => mockFindEnrollment(...args) }, runnersTable: { findFirst: (...args: unknown[]) => mockFindRunner(...args), findMany: (...args: unknown[]) => mockFindRunners(...args) } }, update: () => builder, select: () => ({ from: () => ({ where: () => ({ execute: () => mockFindOwners() }) }) }) } }));
jest.mock("@actions/auth", () => ({ validateAuth: jest.fn().mockResolvedValue({ id: "verified-actor" }) }));
jest.mock("@/auth/authorize-operation", () => ({ authorizeCreatorOperation: (input: { creatorId: string; requiredEntitlement?: string }) => mockAuthorize(input), listAuthorizedCreatorOperations: (input: { requiredEntitlement?: string }) => mockListCreators(input) }));
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));
import { submitRunnerSelection, getAccessiblePendingRunners } from "@/app/runner/enroll/actions";
describe("Runner enrollment owner access", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockSet.mockReturnValue(builder);
		mockFindEnrollment.mockResolvedValue({ id: "enrollment", runnerId: null, approvedAt: null, expiresAt: new Date(Date.now() + 60000), hostname: "Free PC", osInfo: "Linux", version: "fixture" });
		mockFindRunner.mockResolvedValue({ id: "free-device", ownerId: "free-owner", name: "New Hardware Node" });
	});
	it("TDD-US1-FR001 enrollment: authorized Free owner approves a device without a Runner entitlement", async () => {
		const data = new FormData();
		data.set("code", "ABCD-EFGH");
		data.set("runnerId", "free-device");
		expect(await submitRunnerSelection({ status: "idle" }, data)).toEqual({ status: "approved", runnerId: "free-device" });
		expect(mockAuthorize).toHaveBeenCalledWith(expect.objectContaining({ creatorId: "free-owner", resourceOwnerId: "free-owner", permission: "runner:control" }));
		expect(mockSet).toHaveBeenCalledTimes(2);
	});

	it("TDD-US1-FR001 pending enrollment: Free owned devices appear without a paid add-on", async () => {
		mockFindRunners.mockResolvedValue([{ id: "free-device", ownerId: "free-owner", name: "Free PC", createdAt: new Date("2026-10-14T12:00:00.000Z"), token: "private-device-token" }]);
		const devices = await getAccessiblePendingRunners("verified-actor");
		expect(devices).toEqual([{ id: "free-device", ownerId: "free-owner", name: "Free PC", ownerName: "Free creator", ownerAvatar: "", createdAt: "2026-10-14T12:00:00.000Z" }]);
		expect(devices[0]).not.toHaveProperty("token");
	});

	it("TDD-US1-FR001 enrollment authorization: denied control cannot approve or modify the device", async () => {
		mockAuthorize.mockResolvedValueOnce({ allowed: false, code: "PERMISSION_DENIED" });
		const data = new FormData();
		data.set("code", "ABCD-EFGH");
		data.set("runnerId", "free-device");
		expect(await submitRunnerSelection({ status: "idle" }, data)).toEqual({ status: "unauthorized" });
		expect(mockSet).not.toHaveBeenCalled();
	});
});
