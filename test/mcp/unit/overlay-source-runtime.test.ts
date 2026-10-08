/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/server/overlays", () => ({ getOverlayRuntimeAccessInternal: jest.fn() }));
jest.mock("@/app/store/overlaySubscribers", () => ({ overlaySubscribers: new Map(), removeSubscriber: jest.fn() }));
import { getOverlayRuntimeAccessInternal } from "@/server/overlays";
import { overlaySubscribers, removeSubscriber } from "@/app/store/overlaySubscribers";
import { revalidateOverlaySource } from "@/server/resources/overlay-source-runtime";

const runtime = getOverlayRuntimeAccessInternal as jest.Mock;
function source(patch: Record<string, unknown> = {}) {
	return { role: "overlay", overlayId: "overlay", ownerId: "owner", sourceSecret: "fixture-capability", sourceActive: true, close: jest.fn(), ...patch } as any;
}
beforeEach(() => {
	jest.clearAllMocks();
	overlaySubscribers.clear();
	runtime.mockReset().mockResolvedValue({ allowed: true, overlay: { ownerId: "owner", status: "active" } });
});

test("current source capability and committed owner policy permit presence", async () => {
	const client = source();
	overlaySubscribers.set("overlay", new Set([client]));
	await expect(revalidateOverlaySource(client)).resolves.toBe(true);
	expect(runtime).toHaveBeenCalledWith("overlay", "websocket", "fixture-capability");
	expect(client.close).not.toHaveBeenCalled();
});
test.each([{ role: "controller" }, { overlayId: undefined }, { ownerId: undefined }, { sourceSecret: undefined }])("missing source authority %p clears capability and closes", async (patch) => {
	const client = source(patch);
	await expect(revalidateOverlaySource(client)).resolves.toBe(false);
	expect(runtime).not.toHaveBeenCalled();
	expect(client.sourceActive).toBe(false);
	expect(client.sourceSecret).toBeUndefined();
	expect(client.close).toHaveBeenCalledWith(4002);
});
test("unregistered source cannot restore presence", async () => {
	const client = source();
	await expect(revalidateOverlaySource(client)).resolves.toBe(false);
	expect(runtime).not.toHaveBeenCalled();
	expect(removeSubscriber).toHaveBeenCalledWith("owner", "overlay", client);
});
test.each([null, { allowed: false }, { allowed: true, overlay: { ownerId: "foreign", status: "active" } }, { allowed: true, overlay: { ownerId: "owner", status: "paused" } }])("committed policy %p refuses the existing source", async (decision) => {
	runtime.mockResolvedValue(decision);
	const client = source();
	overlaySubscribers.set("overlay", new Set([client]));
	await expect(revalidateOverlaySource(client)).resolves.toBe(false);
	expect(client.sourceActive).toBe(false);
	expect(client.close).toHaveBeenCalledWith(4002);
	expect(removeSubscriber).toHaveBeenCalledWith("owner", "overlay", client);
});
test("failed policy lookup refuses presence", async () => {
	runtime.mockRejectedValue(new Error("private database failure"));
	const client = source();
	overlaySubscribers.set("overlay", new Set([client]));
	await expect(revalidateOverlaySource(client)).resolves.toBe(false);
	expect(client.close).toHaveBeenCalledWith(4002);
});
test.each(["overlayId", "ownerId", "sourceSecret"])("concurrent resubscription changing %s is preserved", async (key) => {
	const client = source();
	overlaySubscribers.set("overlay", new Set([client]));
	runtime.mockImplementation(async () => {
		client[key] = "new-subscription";
		return { allowed: true, overlay: { ownerId: "owner", status: "active" } };
	});
	await expect(revalidateOverlaySource(client)).resolves.toBe(false);
	expect(client.close).not.toHaveBeenCalled();
	expect(removeSubscriber).not.toHaveBeenCalled();
	expect(client.sourceActive).toBe(true);
});
test("a source removed while policy is resolving cannot regain presence", async () => {
	const client = source();
	overlaySubscribers.set("overlay", new Set([client]));
	runtime.mockImplementation(async () => {
		overlaySubscribers.delete("overlay");
		return { allowed: true, overlay: { ownerId: "owner", status: "active" } };
	});
	await expect(revalidateOverlaySource(client)).resolves.toBe(false);
	expect(client.close).toHaveBeenCalledWith(4002);
});
