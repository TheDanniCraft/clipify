import { render, waitFor, fireEvent, screen } from "@testing-library/react";
import RuntimeDeploymentReload from "@/app/components/RuntimeDeploymentReload";
import { DEPLOYMENT_CHECK_EVENT } from "@/app/lib/deployment";

let pathname = "/dashboard";

jest.mock("next/navigation", () => ({
	usePathname: () => pathname,
}));

describe("RuntimeDeploymentReload", () => {
	const originalFetch = global.fetch;
	const originalRequest = global.Request;
	const fetchMock = jest.fn();

	beforeEach(() => {
		pathname = "/dashboard";
		global.Request = class {} as unknown as typeof Request;
		fetchMock.mockReset();
		fetchMock.mockResolvedValue({ ok: true, headers: { get: () => "deployment-1" } });
		global.fetch = fetchMock as typeof fetch;
	});

	afterAll(() => {
		global.fetch = originalFetch;
		global.Request = originalRequest;
	});

	it("checks for a newer deployment on an overlay runtime page", async () => {
		pathname = "/overlay/overlay-1";
		const view = render(<RuntimeDeploymentReload deploymentId='deployment-1' />);

		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/deployment", { cache: "no-store", credentials: "omit" }));
		view.unmount();
	});

	it.each(["/gallery", "/gallery/gallery-1", "/runner/preview/runner-1", "/pricing"])("monitors %s without waiting for interaction", async (path) => {
		pathname = path;
		const view = render(<RuntimeDeploymentReload deploymentId='deployment-1' />);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/deployment", { cache: "no-store", credentials: "omit" }));
		view.unmount();
	});

	it("checks immediately when a runtime transition requests it", async () => {
		pathname = "/gallery/gallery-1/clip/clip-1";
		const view = render(<RuntimeDeploymentReload deploymentId='deployment-1' />);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		window.dispatchEvent(new Event(DEPLOYMENT_CHECK_EVENT));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		view.unmount();
	});

	it("checks on OBS activation and ignores preview visibility and deactivation", async () => {
		pathname = "/overlay/overlay-1";
		const view = render(<RuntimeDeploymentReload deploymentId='deployment-1' />);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		window.dispatchEvent(new CustomEvent("obsSourceVisibleChanged", { detail: { visible: true } }));
		window.dispatchEvent(new CustomEvent("obsSourceActiveChanged", { detail: { active: false } }));
		expect(fetchMock).toHaveBeenCalledTimes(1);
		window.dispatchEvent(new CustomEvent("obsSourceActiveChanged", { detail: { active: true } }));
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		view.unmount();
		window.dispatchEvent(new CustomEvent("obsSourceActiveChanged", { detail: { active: true } }));
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("does not poll dashboard editors", () => {
		const view = render(<RuntimeDeploymentReload deploymentId='deployment-1' />);

		expect(fetchMock).not.toHaveBeenCalled();
		view.unmount();
	});

	it("checks a caught missing Server Action on a dashboard without retrying the mutation", async () => {
		const view = render(<RuntimeDeploymentReload deploymentId='deployment-1' />);
		fetchMock.mockResolvedValueOnce({ ok: false, headers: { get: (name: string) => (name === "x-nextjs-action-not-found" ? "1" : null) } });
		await window.fetch("/dashboard/runners/one", { method: "POST", headers: { "Next-Action": "old-action" }, body: "draft" });
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		expect(fetchMock.mock.calls[1]).toEqual(["/api/deployment", { cache: "no-store", credentials: "omit" }]);
		expect(fetchMock.mock.calls.filter(([url]) => url === "/dashboard/runners/one")).toHaveLength(1);
		await expect(window.fetch("/dashboard/runners/one", { method: "POST", headers: { "Next-Action": "old-action" } })).rejects.toMatchObject({ name: "UnrecognizedActionError" });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		view.unmount();
	});

	it("recovers a missing action even when deployment metadata is not configured", async () => {
		fetchMock.mockResolvedValueOnce({ ok: false, headers: { get: (name: string) => (name === "x-nextjs-action-not-found" ? "1" : null) } }).mockResolvedValueOnce({ ok: true, headers: { get: () => "" } });
		const view = render(<RuntimeDeploymentReload deploymentId='' />);
		await window.fetch("/dashboard/settings", { method: "POST", headers: { "Next-Action": "old-action" } });
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		expect(screen.queryByRole("button", { name: "Keep editing" })).not.toBeInTheDocument();
		expect(screen.getByText(/Refresh Clipify before saving/)).toBeVisible();
		expect(screen.getByRole("button", { name: "Refresh Clipify" })).toBeVisible();
		view.unmount();
	});

	it("does not treat validation or an external service response as a missing dashboard action", async () => {
		const view = render(<RuntimeDeploymentReload deploymentId='deployment-1' />);
		await window.fetch("/dashboard/settings", { method: "POST", headers: { "Next-Action": "valid-action" } });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		fetchMock.mockResolvedValueOnce({ ok: false, headers: { get: () => "1" } });
		await window.fetch("https://example.org/", { headers: { "Next-Action": "external" } });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		view.unmount();
	});
	it("protects newly entered secrets but does not mistake an existing masked value for an edit", () => {
		const preserve = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new DOMException("Storage full", "QuotaExceededError");
		});
		const view = render(<RuntimeDeploymentReload deploymentId='deployment-1' />);
		const input = document.createElement("input");
		input.type = "password";
		input.value = "existing-server-token";
		document.body.append(input);
		try {
			fireEvent.click(screen.getByRole("button", { name: "Refresh Clipify" }));
			expect(preserve).toHaveBeenCalledTimes(1);
			expect(screen.getByRole("alert")).toHaveTextContent("could not preserve");
			fireEvent.input(input, { target: { value: "new-secret" } });
			fireEvent.click(screen.getByRole("button", { name: "Refresh Clipify" }));
			expect(screen.getByRole("alert")).toHaveTextContent("unsaved passwords");
			expect(preserve).toHaveBeenCalledTimes(1);
			fireEvent.input(input, { target: { value: "" } });
			fireEvent.click(screen.getByRole("button", { name: "Refresh Clipify" }));
			expect(preserve).toHaveBeenCalledTimes(2);
		} finally {
			input.remove();
			view.unmount();
			preserve.mockRestore();
		}
	});
});
