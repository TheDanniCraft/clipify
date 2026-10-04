import { render, waitFor } from "@testing-library/react";
import RuntimeDeploymentReload from "@/app/components/RuntimeDeploymentReload";
import { DEPLOYMENT_CHECK_EVENT } from "@/app/lib/deployment";

let pathname = "/";

jest.mock("next/navigation", () => ({
	usePathname: () => pathname,
}));

describe("RuntimeDeploymentReload", () => {
	const originalFetch = global.fetch;
	const fetchMock = jest.fn();

	beforeEach(() => {
		pathname = "/";
		fetchMock.mockReset();
		fetchMock.mockResolvedValue({ ok: true, headers: { get: () => "deployment-1" } });
		global.fetch = fetchMock as typeof fetch;
	});

	afterAll(() => {
		global.fetch = originalFetch;
	});

	it("checks for a newer deployment on an overlay runtime page", async () => {
		pathname = "/overlay/overlay-1";
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

	it("does not poll ordinary application pages", () => {
		const view = render(<RuntimeDeploymentReload deploymentId='deployment-1' />);

		expect(fetchMock).not.toHaveBeenCalled();
		view.unmount();
	});
});
