/** @jest-environment node */
import { Plan, EntitlementGrantSource } from "@types";
const globalSelect = jest.fn(() => {
	throw new Error("GLOBAL_DATABASE_READ");
});
jest.mock("@/db/client", () => ({ db: { select: () => globalSelect() } }));
import { resolveUserEntitlements } from "@lib/entitlements";
import { resolveRetainedResourceAccess } from "@/server/entitlements/resource-access";
function transaction(rows: unknown[][]) {
	let index = 0;
	const builder: any = { from: jest.fn(() => builder), where: jest.fn(() => builder), orderBy: jest.fn(() => builder), limit: jest.fn(() => builder), execute: jest.fn(async () => rows[index++] ?? []) };
	return { select: jest.fn(() => builder), builder };
}
describe("current owner entitlement reads stay inside caller transaction", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.ENTITLEMENTS_HYBRID_ENABLED = "true";
	});
	test("billing Pro resolves runner access in the transaction", async () => {
		const tx = transaction([[], []]);
		const result = await (resolveUserEntitlements as any)({ id: "owner", plan: Plan.Pro }, tx);
		expect(result.effectivePlan).toBe("pro");
		expect(tx.select).toHaveBeenCalledTimes(2);
		expect(globalSelect).not.toHaveBeenCalled();
	});
	test("Free owner reads grants, agency Pro and runner allocations in the transaction", async () => {
		const tx = transaction([[], [], [], []]);
		const result = await (resolveUserEntitlements as any)({ id: "owner", plan: Plan.Free }, tx);
		expect(result.effectivePlan).toBe("free");
		expect(tx.select).toHaveBeenCalledTimes(4);
		expect(globalSelect).not.toHaveBeenCalled();
	});
	test("active partner grant is authoritative inside the transaction", async () => {
		const tx = transaction([[{ source: EntitlementGrantSource.Partner, startsAt: new Date(0), endsAt: null }], [], []]);
		const result = await (resolveUserEntitlements as any)({ id: "owner", plan: Plan.Free }, tx);
		expect(result.effectivePlan).toBe("pro");
		expect(result.source).toBe("grant");
		expect(globalSelect).not.toHaveBeenCalled();
	});
	test("retained resource policy resolves the same locked owner transaction", async () => {
		const tx = transaction([[{ id: "owner", plan: Plan.Pro }], [], []]);
		const access = await resolveRetainedResourceAccess({ kind: "overlay", ownerId: "owner", resourceId: "overlay", client: tx as any });
		expect(access).toMatchObject({ effectivePlan: "pro", update: true });
		expect(globalSelect).not.toHaveBeenCalled();
	});
	test("missing owner preserves read/delete but cannot authorize retained edits or runtime", async () => {
		const tx = transaction([[]]);
		const access = await resolveRetainedResourceAccess({ kind: "overlay", ownerId: "missing-owner", resourceId: "retained", client: tx as any });
		expect(access).toEqual({ effectivePlan: "free", read: true, delete: true, update: false, runtime: false, withinFreeAllowance: false });
		expect(tx.select).toHaveBeenCalledTimes(1);
		expect(globalSelect).not.toHaveBeenCalled();
	});
	test.each(["overlay", "playlist", "gallery"] as const)("Free %s policy permits only the earliest retained resource", async (kind) => {
		for (const resourceId of ["first-resource", "later-resource"]) {
			const tx = transaction([[{ id: "first-resource" }]]);
			const access = await resolveRetainedResourceAccess({ kind, ownerId: "owner", resourceId, effectivePlan: "free", client: tx as any });
			expect(access).toEqual({ effectivePlan: "free", read: true, delete: true, update: resourceId === "first-resource", runtime: resourceId === "first-resource", withinFreeAllowance: resourceId === "first-resource" });
			expect(tx.builder.orderBy).toHaveBeenCalledTimes(1);
			expect(tx.builder.limit).toHaveBeenCalledWith(1);
			expect(globalSelect).not.toHaveBeenCalled();
		}
	});
	test("explicit effective Pro access does not perform a Free-resource lookup", async () => {
		const tx = transaction([]);
		expect(await resolveRetainedResourceAccess({ kind: "playlist", ownerId: "owner", resourceId: "later-resource", effectivePlan: "pro", client: tx as any })).toMatchObject({ read: true, delete: true, update: true, runtime: true });
		expect(tx.select).not.toHaveBeenCalled();
		expect(globalSelect).not.toHaveBeenCalled();
	});
	test("Free owner entitlement resolution and retained selection use the supplied transaction", async () => {
		const tx = transaction([[{ id: "owner", plan: Plan.Free }], [], [], [], [], [{ id: "first-resource" }]]);
		expect(await resolveRetainedResourceAccess({ kind: "overlay", ownerId: "owner", resourceId: "first-resource", client: tx as any })).toMatchObject({ effectivePlan: "free", update: true, runtime: true });
		expect(tx.select).toHaveBeenCalledTimes(6);
		expect(globalSelect).not.toHaveBeenCalled();
	});
});
