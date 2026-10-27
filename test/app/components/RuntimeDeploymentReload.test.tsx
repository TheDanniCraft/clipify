import { act, render, waitFor, fireEvent, screen } from "@testing-library/react";
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
		sessionStorage.clear();
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

	it.each(["/dashboard", "/dashboard/settings", "/dashboard/settings/team", "/dashboard/overlay/one", "/dashboard/playlist/one", "/dashboard/runners/one"])("detects updates on %s without automatically refreshing", async (path) => {
		pathname = path;
		fetchMock.mockResolvedValue({ ok: true, headers: { get: () => "deployment-2" } });
		const view = render(<RuntimeDeploymentReload deploymentId='deployment-1' />);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/deployment", { cache: "no-store", credentials: "omit" }));
		expect(screen.getByText("Clipify has been updated")).toBeVisible();
		expect(screen.getByRole("button", { name: "Refresh Clipify" })).toBeVisible();
		expect(sessionStorage.getItem(`clipify:deployment-reload:${window.location.pathname}`)).toBeNull();
		view.unmount();
	});

	it("checks periodically and on returning to a visible dashboard tab", async () => {
		jest.useFakeTimers();
		const view = render(<RuntimeDeploymentReload deploymentId='deployment-1' />);
		try {
			await act(async () => {
				await jest.advanceTimersByTimeAsync(0);
			});
			expect(fetchMock).toHaveBeenCalledTimes(1);
			await act(async () => {
				await jest.advanceTimersByTimeAsync(5 * 60_000);
			});
			expect(fetchMock).toHaveBeenCalledTimes(2);
			await act(async () => {
				document.dispatchEvent(new Event("visibilitychange"));
			});
			expect(fetchMock).toHaveBeenCalledTimes(3);
		} finally {
			view.unmount();
			jest.useRealTimers();
		}
	});

	it("checks a caught missing Server Action on a dashboard without retrying the mutation", async () => {
		const view = render(<RuntimeDeploymentReload deploymentId='deployment-1' />);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		fetchMock.mockClear();
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

	it("queues the update dialog until the active dialog closes", async () => {
		const activeDialog = document.createElement("div");
		activeDialog.setAttribute("role", "dialog");
		activeDialog.setAttribute("aria-label", "Edit destination");
		document.body.append(activeDialog);
		const view = render(<RuntimeDeploymentReload deploymentId='deployment-1' />);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		fetchMock.mockClear();
		fetchMock.mockResolvedValueOnce({ ok: false, headers: { get: (name: string) => (name === "x-nextjs-action-not-found" ? "1" : null) } }).mockResolvedValueOnce({ ok: true, headers: { get: () => "deployment-2" } });
		try {
			await window.fetch("/dashboard/runners/one", { method: "POST", headers: { "Next-Action": "old-action" } });
			expect(await screen.findByRole("button", { name: "Refresh required" })).toBeVisible();
			activeDialog.remove();
			await waitFor(() => expect(screen.queryByRole("button", { name: "Refresh required" })).not.toBeInTheDocument());
		} finally {
			activeDialog.remove();
			view.unmount();
		}
	});

	it("does not treat validation or an external service response as a missing dashboard action", async () => {
		const view = render(<RuntimeDeploymentReload deploymentId='deployment-1' />);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		fetchMock.mockClear();
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
