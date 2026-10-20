import { act, renderHook } from "@testing-library/react";
import { preserveDeploymentDrafts, useDeploymentDraft } from "@/app/lib/deploymentDrafts";

beforeEach(() => sessionStorage.clear());
test("preserves edits and the original optimistic revision across a deployment reload without copying unchanged secrets", () => {
	const saved = { title: "Old", configurationRevision: 3, secret: "must-not-be-stored" };
	const first = renderHook(() => useDeploymentDraft("owner:resource", { ...saved, title: "Unsaved" }, saved, jest.fn()));
	expect(preserveDeploymentDrafts()).toBe(true);
	expect(sessionStorage.getItem("clipify:deployment-drafts")).not.toContain("must-not-be-stored");
	first.unmount();
	const restore = jest.fn();
	const fresh = { ...saved, title: "Another editor saved", configurationRevision: 4 };
	const second = renderHook(() => useDeploymentDraft("owner:resource", fresh, fresh, restore));
	expect(restore).toHaveBeenCalledWith({ ...saved, title: "Unsaved" }, saved);
	second.unmount();
});
test("does not persist a changed password or discard the editor on a storage failure", () => {
	const view = renderHook(() => useDeploymentDraft("owner:secret", { password: "new" }, { password: "" }, jest.fn()));
	expect(preserveDeploymentDrafts()).toBe(false);
	expect(sessionStorage.getItem("clipify:deployment-drafts")).toBeNull();
	view.unmount();
});
test("captures the latest draft, isolates owners and consumes recovery once", () => {
	const view = renderHook(({ name }) => useDeploymentDraft("one", { name }, { name: "saved" }, jest.fn()), { initialProps: { name: "first" } });
	view.rerender({ name: "latest" });
	act(() => {
		expect(preserveDeploymentDrafts()).toBe(true);
	});
	view.unmount();
	const other = jest.fn();
	const otherView = renderHook(() => useDeploymentDraft("two", { name: "saved" }, { name: "saved" }, other));
	expect(other).not.toHaveBeenCalled();
	otherView.unmount();
	const restore = jest.fn();
	const recovered = renderHook(() => useDeploymentDraft("one", { name: "saved" }, { name: "saved" }, restore));
	expect(restore).toHaveBeenCalledWith({ name: "latest" }, { name: "saved" });
	recovered.unmount();
	const again = renderHook(() => useDeploymentDraft("one", { name: "saved" }, { name: "saved" }, restore));
	expect(restore).toHaveBeenCalledTimes(1);
	again.unmount();
});
test("ignores expired, malformed and foreign-route drafts", () => {
	for (const record of ["broken", JSON.stringify({ pathname: "/", expiresAt: Date.now() - 1, drafts: { one: { changes: { name: "lost" }, baseline: { name: "old" } } } }), JSON.stringify({ pathname: "/different", expiresAt: Date.now() + 1000, drafts: { one: { changes: { name: "foreign" }, baseline: {} } } })]) {
		sessionStorage.setItem("clipify:deployment-drafts", record);
		const restore = jest.fn();
		const view = renderHook(() => useDeploymentDraft("one", { name: "saved" }, { name: "saved" }, restore));
		expect(restore).not.toHaveBeenCalled();
		view.unmount();
	}
});
test("refuses to reload if session storage is full", () => {
	const storage = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
		throw new DOMException("Storage full", "QuotaExceededError");
	});
	try {
		expect(preserveDeploymentDrafts()).toBe(false);
	} finally {
		storage.mockRestore();
	}
});
