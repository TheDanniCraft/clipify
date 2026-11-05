const notify = jest.fn();
jest.mock("@lib/toast", () => ({ notify: (...args: unknown[]) => notify(...args) }));
jest.mock("@components/controlledModal", () => ({
	__esModule: true,
	default: ({ isOpen, children, onClose }: any) =>
		isOpen ? (
			<section role='dialog'>
				<button aria-label='Close dialog' onClick={onClose}>
					Close
				</button>
				{children}
			</section>
		) : null,
}));
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ClipExportProvider, ExportQueueLauncher } from "@components/creator/clipExportQueue";
import ClipExport from "@components/creator/clipExport";
import { toast } from "@heroui/react";
const fetchMock = jest.fn();
const originalFetch = globalThis.fetch;
function responseJSON(value: unknown) {
	let done = false;
	return { ok: false, headers: { get: () => null }, body: { getReader: () => ({ read: async () => (done ? { done: true } : ((done = true), { done: false, value: new TextEncoder().encode(JSON.stringify(value)) })), releaseLock: jest.fn(), cancel: jest.fn() }) } };
}
beforeEach(() => {
	fetchMock.mockReset();
	notify.mockClear();
	globalThis.fetch = fetchMock;
});
afterEach(() => {
	globalThis.fetch = originalFetch;
	jest.restoreAllMocks();
});
it("retries only retryable unsuccessful IDs when every download failed", async () => {
	fetchMock
		.mockResolvedValueOnce(
			responseJSON({
				code: "PROVIDER_UNAVAILABLE",
				failures: [
					{ index: 0, code: "clip_unavailable", retryable: false },
					{ index: 1, code: "provider_error", retryable: true },
					{ index: 2, code: "download_unavailable", retryable: false },
				],
			}),
		)
		.mockResolvedValue(responseJSON({ code: "PROVIDER_UNAVAILABLE" }));
	render(<ClipExport creatorId='owner' clipIds={["A", "B", "C"]} scope='owner' />);
	fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
	await screen.findByRole("button", { name: "Retry failed clips" });
	fireEvent.click(screen.getByRole("button", { name: "Retry failed clips" }));
	await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
	expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ creatorId: "owner", clipIds: ["B"] });
});

it("keeps permanent failures visible without offering a futile retry", async () => {
	fetchMock.mockResolvedValue(responseJSON({ code: "EXPORT_UNAVAILABLE", failures: [{ index: 0, code: "clip_unavailable", retryable: false }] }));
	render(<ClipExport creatorId='owner' clipIds={["A"]} scope='owner' />);
	fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
	await screen.findByText("Clip unavailable");
	expect(screen.queryByRole("button", { name: "Retry failed clips" })).not.toBeInTheDocument();
});
it("separates reconnect recovery from transient retries", async () => {
	fetchMock.mockResolvedValue(
		responseJSON({
			code: "RECONNECT_REQUIRED",
			failures: [
				{ index: 0, code: "reconnect_required", retryable: false },
				{ index: 1, code: "provider_error", retryable: true },
			],
		}),
	);
	render(<ClipExport creatorId='owner' clipIds={["A", "B"]} scope='owner' />);
	fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
	await screen.findByRole("button", { name: "Retry after reconnect" });
	expect(screen.getByRole("link", { name: /Reconnect Twitch/ })).toHaveAttribute("target", "_blank");
	fireEvent.click(screen.getByRole("button", { name: "Retry after reconnect" }));
	await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
	expect(JSON.parse(fetchMock.mock.calls[1][1].body).clipIds).toEqual(["A"]);
});
it("cancels an in-flight export without clearing the selection", async () => {
	fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")))));
	render(<ClipExport creatorId='owner' clipIds={["A"]} scope='owner' />);
	fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
	fireEvent.click(screen.getByRole("button", { name: "Cancel export" }));
	await screen.findByText("Export cancelled. Your selection is kept.");
	expect(notify).not.toHaveBeenCalled();
	expect(screen.getByRole("button", { name: "Export selected" })).toBeEnabled();
});
it("aborts and hides an export when the creator changes", async () => {
	fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")))));
	const view = render(<ClipExport creatorId='owner' clipIds={["A"]} scope='one' />);
	fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
	view.rerender(<ClipExport creatorId='other' clipIds={[]} scope='two' />);
	await waitFor(() => expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true));
	expect(screen.queryByText(/Export cancelled/)).not.toBeInTheDocument();
});
it("normalizes malformed error packets instead of retrying untrusted positions", async () => {
	fetchMock.mockResolvedValue(responseJSON({ code: "PROVIDER_UNAVAILABLE", failures: [{ index: 50, code: "provider_error", retryable: true }] }));
	render(<ClipExport creatorId='owner' clipIds={["A"]} scope='one' />);
	fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
	await screen.findByText("The download response was incomplete. Please try again.");
});
it("rejects a zero-byte ZIP response before initiating a download", async () => {
	fetchMock.mockResolvedValue({
		ok: true,
		headers: {
			get: (name: string) =>
				name === "content-type"
					? "application/zip"
					: btoa(JSON.stringify({ included: [0], skipped: [] }))
							.replace(/=/g, "")
							.replace(/\+/g, "-")
							.replace(/\//g, "_"),
		},
		body: null,
	});
	const create = jest.fn();
	Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
	render(<ClipExport creatorId='owner' clipIds={["A"]} scope='owner' />);
	fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
	await screen.findByText("The download response was incomplete. Please try again.");
	expect(create).not.toHaveBeenCalled();
});

function successResponse(summary: unknown) {
	const { zipSync, strToU8 } = jest.requireActual("fflate");
	const bytes = zipSync({ "manifest.json": strToU8("{}"), "clip.mp4": new Uint8Array([1, 2, 3]) });
	let done = false;
	return { ok: true, headers: { get: (name: string) => (name === "content-type" ? "application/zip" : btoa(JSON.stringify(summary)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")) }, body: { getReader: () => ({ read: async () => (done ? { done: true } : ((done = true), { done: false, value: bytes })), releaseLock: jest.fn(), cancel: jest.fn() }) } };
}
it("downloads a validated ZIP, excludes successful IDs from retry and releases the Blob on unmount", async () => {
	const create = jest.fn(() => "blob:clips");
	const revoke = jest.fn();
	Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
	const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
	fetchMock.mockResolvedValueOnce(successResponse({ included: [0], skipped: [{ index: 1, code: "provider_error", retryable: true }] })).mockResolvedValue(responseJSON({ code: "PROVIDER_UNAVAILABLE" }));
	const view = render(<ClipExport creatorId='owner' clipIds={["A", "B"]} scope='owner' />);
	fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
	await screen.findByText(/1 clip ready/);
	expect(click).toHaveBeenCalledTimes(1);
	expect(create).toHaveBeenCalledTimes(1);
	fireEvent.click(screen.getByRole("button", { name: "Retry failed clips" }));
	await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
	expect(JSON.parse(fetchMock.mock.calls[1][1].body).clipIds).toEqual(["B"]);
	view.unmount();
	expect(revoke).toHaveBeenCalledWith("blob:clips");
});
it("does not enable export without an explicit selection", () => {
	render(<ClipExport creatorId='owner' clipIds={[]} scope='owner' />);
	expect(screen.getByRole("button", { name: "Export selected" })).toBeDisabled();
	expect(fetchMock).not.toHaveBeenCalled();
});
it("rejects a successful response with an unexpected content type", async () => {
	fetchMock.mockResolvedValue({ ok: true, headers: { get: () => "text/html" } });
	render(<ClipExport creatorId='owner' clipIds={["A"]} scope='owner' />);
	fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
	await screen.findByText("The download response was incomplete. Please try again.");
});
it("reports transport errors locally and keeps retry available", async () => {
	fetchMock.mockRejectedValue(new Error("network"));
	render(<ClipExport creatorId='owner' clipIds={["A"]} scope='owner' />);
	fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
	await screen.findByText("The export could not be prepared. Please try again.");
	expect(screen.getByRole("button", { name: "Retry failed clips" })).toBeEnabled();
});

it("resumes the waiting batch automatically when the provider quota resets", async () => {
	jest.useFakeTimers();
	try {
		fetchMock.mockResolvedValueOnce(responseJSON({ code: "RATE_LIMITED", retryAt: new Date(Date.now() + 1000).toISOString() })).mockRejectedValue(new Error("offline"));
		render(<ClipExport creatorId='owner' clipIds={["A"]} scope='owner' />);
		fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
		await screen.findByText(/Waiting for the download limit/);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		await act(async () => {
			await jest.advanceTimersByTimeAsync(1100);
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
		await screen.findByRole("button", { name: "Retry failed clips" });
	} finally {
		jest.useRealTimers();
	}
});
it("replaces previous Blob URLs and releases the latest download after sixty seconds", async () => {
	jest.useFakeTimers();
	try {
		let index = 0;
		const revoke = jest.fn();
		Object.defineProperty(URL, "createObjectURL", { configurable: true, value: () => `blob:${++index}` });
		Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
		jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
		fetchMock.mockResolvedValueOnce(successResponse({ included: [0], skipped: [] })).mockResolvedValueOnce(successResponse({ included: [0], skipped: [] }));
		render(<ClipExport creatorId='owner' clipIds={["A"]} scope='owner' />);
		fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
		await screen.findByText("1 clip ready. Download initiated.");
		expect(notify).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
		await waitFor(() => expect(index).toBe(2));
		expect(revoke).toHaveBeenCalledWith("blob:1");
		await act(async () => {
			jest.advanceTimersByTime(60000);
		});
		expect(revoke).toHaveBeenCalledWith("blob:2");
	} finally {
		jest.useRealTimers();
	}
});
it("offers reconnect-only retry when the provider requires a renewed token before preparing downloads", async () => {
	fetchMock.mockResolvedValue(responseJSON({ code: "RECONNECT_REQUIRED" }));
	render(<ClipExport creatorId='owner' clipIds={["A"]} scope='owner' />);
	fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
	await screen.findByRole("button", { name: "Retry after reconnect" });
	expect(screen.queryByRole("button", { name: "Retry failed clips" })).not.toBeInTheDocument();
});
it("bounds the client selection before issuing a request", () => {
	render(<ClipExport creatorId='owner' clipIds={Array.from({ length: 501 }, (_, i) => String(i))} scope='owner' />);
	fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
	expect(fetchMock).not.toHaveBeenCalled();
});
it.each([
	["ACCOUNT_SUSPENDED", "This creator account is suspended. Contact support before exporting clips."],
	["ENTITLEMENT_REQUIRED", "This team access needs an active Pro plan. Ask the creator to review their plan."],
])("explains the actionable %s restriction without a futile retry", async (code, message) => {
	fetchMock.mockResolvedValue(responseJSON({ code }));
	render(<ClipExport creatorId='owner' clipIds={["A"]} scope='owner' />);
	fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
	await screen.findByText(message);
	expect(screen.queryByRole("button", { name: "Retry failed clips" })).not.toBeInTheDocument();
});
it("does not keep a late provider reset disabled after its deadline has already passed", async () => {
	jest.useFakeTimers();
	try {
		const mountedAt = Date.now();
		fetchMock.mockResolvedValue(responseJSON({ code: "RATE_LIMITED", retryAt: new Date(mountedAt + 30000).toISOString() }));
		render(<ClipExport creatorId='owner' clipIds={["A"]} scope='owner' />);
		jest.setSystemTime(mountedAt + 60000);
		fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
		const retry = await screen.findByRole("button", { name: "Retry failed clips" });
		expect(retry).toBeEnabled();
		expect(screen.queryByText(/Please wait until/)).not.toBeInTheDocument();
	} finally {
		jest.useRealTimers();
	}
});
it("downloads individual MP4 and supports reopening and dismissing result details", async () => {
	const bytes = new Uint8Array([0, 0, 0, 8, 102, 116, 121, 112]);
	let read = false;
	const summary = btoa(JSON.stringify({ included: [0], skipped: [] }))
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");
	fetchMock.mockResolvedValue({ ok: true, headers: { get: (name: string) => (name === "content-type" ? "video/mp4" : summary) }, body: { getReader: () => ({ read: async () => (read ? { done: true } : ((read = true), { done: false, value: bytes })), cancel: jest.fn(), releaseLock: jest.fn() }) } });
	const create = jest.fn(() => "blob:mp4");
	Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
	const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
		expect(this.download).toBe("clipify-A.mp4");
	});
	render(
		<ClipExportProvider creatorId='owner'>
			<ExportQueueLauncher />
			<ClipExport creatorId='owner' clipIds={["A"]} scope='owner:A' format='mp4' />
		</ClipExportProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Download original" }));
	await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
	expect(fetchMock.mock.calls[0][0]).toBe("/api/clips/export?format=mp4&progress=1");
	expect(create).toHaveBeenCalledWith(expect.objectContaining({ type: "video/mp4" }));
	fireEvent.click(screen.getByRole("button", { name: "Exports" }));
	expect(screen.getByRole("dialog")).toHaveTextContent("1 clip ready");
	fireEvent.click(screen.getByRole("button", { name: "Close exports" }));
	expect(screen.queryByRole("dialog")).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "Exports" }));
	fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
	expect(screen.queryByRole("dialog")).toBeNull();
});
it("keeps the export label fixed and processes a fifty-one clip selection in timed batches", async () => {
	jest.useFakeTimers();
	try {
		Object.defineProperty(URL, "createObjectURL", { configurable: true, value: jest.fn(() => "blob:batch") });
		Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
		jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
		fetchMock.mockImplementation((_url, options) => successResponse({ included: JSON.parse(options.body).clipIds.map((_: string, index: number) => index), skipped: [] }));
		const view = render(<ClipExport creatorId='owner' clipIds={Array.from({ length: 51 }, (_, index) => String(index))} scope='many' />);
		fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
		await screen.findByText(/Waiting for the download limit/);
		expect(screen.getByRole("button", { name: "Export selected" })).toHaveTextContent("Export selected");
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(JSON.parse(fetchMock.mock.calls[0][1].body).clipIds).toHaveLength(50);
		await act(async () => {
			await jest.advanceTimersByTimeAsync(60001);
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(JSON.parse(fetchMock.mock.calls[1][1].body).clipIds).toEqual(["50"]);
		view.unmount();
	} finally {
		jest.useRealTimers();
	}
});
it("continues an active export when its dialog and page are closed, and reopens it from Exports", async () => {
	let finish!: (value: unknown) => void;
	fetchMock.mockImplementation(
		() =>
			new Promise((resolve) => {
				finish = resolve;
			}),
	);
	Object.defineProperty(URL, "createObjectURL", { configurable: true, value: jest.fn(() => "blob:background") });
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
	const download = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
	const view = render(
		<ClipExportProvider creatorId='owner'>
			<ExportQueueLauncher />
			<ClipExport creatorId='owner' clipIds={["A"]} scope='background' />
		</ClipExportProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
	fireEvent.click(screen.getByRole("button", { name: "Continue in background" }));
	expect(screen.queryByRole("dialog")).toBeNull();
	notify.mockReturnValueOnce("background-export");
	const closeToast = jest.spyOn(toast, "close");
	view.rerender(
		<ClipExportProvider creatorId='owner'>
			<ExportQueueLauncher />
			<p>Different dashboard page</p>
		</ClipExportProvider>,
	);
	await act(async () => finish(successResponse({ included: [0], skipped: [] })));
	expect(download).toHaveBeenCalledTimes(1);
	expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Download started" }));
	fireEvent.click(screen.getByRole("button", { name: "Exports" }));
	expect(screen.getByRole("dialog")).toHaveTextContent("1 clip ready");
	expect(closeToast).toHaveBeenCalledWith("background-export");
});
