const mockGuideReport = jest.fn();
jest.mock("@components/user-tour/provider", () => ({ useUserTour: () => ({ report: mockGuideReport }) }));
jest.mock("@components/confirmModal", () => ({
	__esModule: true,
	default: ({ isOpen, title, onConfirm, onOpenChange, confirmLabel, cancelLabel }: any) =>
		isOpen ? (
			<section role='dialog' aria-label={title}>
				<button onClick={onConfirm}>{confirmLabel}</button>
				<button onClick={() => onOpenChange(false)}>{cancelLabel}</button>
			</section>
		) : null,
}));
jest.mock("@components/creator/clipExportSettings", () => ({
	__esModule: true,
	default: ({ creatorId, clipIds, onStart, onClose }: any) => (
		<section>
			<h2>Export clips</h2>
			<button
				onClick={() => {
					const { createClipExportPlan } = jest.requireActual("@lib/clipExportPlan");
					if (onStart(createClipExportPlan(creatorId, clipIds, [{ key: "original", label: "Original" }]), "browser")) onClose();
				}}
			>
				Start export
			</button>
		</section>
	),
}));
const browserBatch = jest.fn();
jest.mock("@lib/clipBrowserBatch", () => ({ buildBrowserBatch: (...args: unknown[]) => browserBatch(...args) }));
const diskArchive = jest.fn();
const releaseArchive = jest.fn(async () => {});
const cleanupDisk = jest.fn(async () => {});
jest.mock("@lib/clipBrowserArchive", () => ({ ...jest.requireActual("@lib/clipBrowserArchive"), cleanupBrowserExports: () => cleanupDisk(), buildBrowserArchive: (...args: unknown[]) => diskArchive(...args) }));
beforeEach(() =>
	diskArchive.mockClear().mockImplementation(async (plans, startedAt, signal, progress) => {
		const included: number[] = [],
			skipped: any[] = [];
		let offset = 0,
			bytes: any;
		for (const plan of plans) {
			const result = await browserBatch(
				plan,
				signal,
				(event: any) => progress({ ...event, index: event.index + offset }),
				() => {},
				"zip",
			);
			if (!result.ok) return result;
			included.push(...result.summary.included.map((index: number) => index + offset));
			skipped.push(...result.summary.skipped.map((item: any) => ({ ...item, index: item.index + offset })));
			offset += plan.files.length;
			bytes = result.bytes;
		}
		return { ok: true, bytes, summary: { included, skipped }, dispose: releaseArchive };
	}),
);
jest.mock("@heroui/react", () => {
	const base = jest.requireActual("../../__mocks__/heroui-react.cjs");
	const Disclosure = Object.assign(
		({ children, isExpanded, onExpandedChange }: any) => (
			<section>
				<button onClick={() => onExpandedChange(!isExpanded)}>Toggle batch history</button>
				{children}
			</section>
		),
		{ Heading: base.Disclosure.Heading, Trigger: base.Disclosure.Trigger, Indicator: base.Disclosure.Indicator, Content: base.Disclosure.Content, Body: base.Disclosure.Body },
	);
	return new Proxy({ ...base, Disclosure, useFilter: () => ({ contains: (text: string, input: string) => text.toLowerCase().includes(input.toLowerCase()) }) }, { get: (target: any, key: any) => (key in target ? target[key] : base[key]) });
});
const notify = jest.fn();
jest.mock("@actions/clipLayoutLibrary", () => ({ listClipLayouts: async () => ({ ok: true, templates: [], defaults: {} }) }));
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
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ClipExportProvider, ExportQueueLauncher, useClipExports } from "@components/creator/clipExportQueue";
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
	mockGuideReport.mockClear();
	browserBatch.mockReset();
	browserBatch.mockImplementation(async (plan: any) => ({ ok: true, bytes: new Uint8Array([1]), summary: { included: plan.files.map((_: any, index: number) => index), skipped: [] } }));
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
	expect(mockGuideReport).not.toHaveBeenCalled();
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
	expect(screen.getByRole("button", { name: "Export selected" })).toBeDisabled();
	fireEvent.click(screen.getByRole("button", { name: "Cancel export" }));
	expect(screen.getByRole("dialog", { name: "Cancel export?" })).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Keep exporting" }));
	expect(screen.queryByText("Export cancelled. Your selection is kept.")).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "Cancel export" }));
	fireEvent.click(screen.getByRole("button", { name: "Stop export" }));
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
	const { zipSync } = jest.requireActual("fflate");
	const bytes = zipSync({ "clip.mp4": new Uint8Array([1, 2, 3]) });
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
it("retains the latest download beyond a minute and releases it on replacement or unmount", async () => {
	jest.useFakeTimers();
	try {
		let index = 0;
		const revoke = jest.fn();
		Object.defineProperty(URL, "createObjectURL", { configurable: true, value: () => `blob:${++index}` });
		Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
		jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
		fetchMock.mockResolvedValueOnce(successResponse({ included: [0], skipped: [] })).mockResolvedValueOnce(successResponse({ included: [0], skipped: [] }));
		const view = render(<ClipExport creatorId='owner' clipIds={["A"]} scope='owner' />);
		fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
		await screen.findByText("1 clip ready. Download initiated.");
		expect(notify).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
		await waitFor(() => expect(index).toBe(2));
		expect(revoke).toHaveBeenCalledWith("blob:1");
		await act(async () => {
			jest.advanceTimersByTime(60000);
		});
		expect(revoke).not.toHaveBeenCalledWith("blob:2");
		expect(screen.getByRole("button", { name: "Download ZIP" })).toBeEnabled();
		expect(fetchMock).toHaveBeenCalledTimes(2);
		view.unmount();
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
it("allows selections beyond the previous total cap", () => {
	render(<ClipExport creatorId='owner' clipIds={Array.from({ length: 501 }, (_, i) => String(i))} scope='owner' />);
	expect(screen.getByRole("button", { name: "Export selected" })).toBeEnabled();
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
		expect(this.download).toBe("clip Original--A.mp4");
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
	await waitFor(() => expect(mockGuideReport).toHaveBeenCalledWith({ type: "export.completed", ownerId: "owner", id: "batch-1" }));
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

it.each([[2], [1, 2]])("queues a four-version package once and retries only failed clip/version pairs %j", async (...failed: number[]) => {
	const { createClipExportPlan } = await import("@lib/clipExportPlan");
	const { createClipComposition } = await import("@lib/clipComposition");
	const plans = createClipExportPlan(
		"owner",
		["A"],
		[
			{ key: "original", label: "Original" },
			{ key: "desktop", label: "Studio Desktop", templateId: "studio", format: "desktop", layout: createClipComposition("desktop") },
			{ key: "mobile1", label: "Mobile camera", layout: createClipComposition("mobile") },
			{ key: "mobile2", label: "Mobile gameplay", layout: createClipComposition("mobile") },
		],
	);
	const Trigger = () => {
		const queue = useClipExports()!;
		return <button onClick={() => queue.enqueuePlans(plans, { A: "My clip" }, "four")}>Start versions</button>;
	};
	browserBatch.mockResolvedValueOnce({ ok: true, bytes: new Uint8Array([1]), summary: { included: [0, 1, 2, 3].filter((index) => !failed.includes(index)), skipped: failed.map((index) => ({ index, code: "provider_error", retryable: true })) } }).mockResolvedValue({ ok: false, code: "PROVIDER_UNAVAILABLE" });
	Object.defineProperty(URL, "createObjectURL", { configurable: true, value: jest.fn(() => "blob:versions") });
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
	jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
	render(
		<ClipExportProvider creatorId='owner'>
			<Trigger />
		</ClipExportProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Start versions" }));
	const retry = await screen.findByRole("button", { name: "Retry failed files" });
	expect(screen.getByText("Layout: Studio", { exact: true })).toBeInTheDocument();
	expect(screen.getByRole("img", { name: "Desktop" })).toBeInTheDocument();
	expect(screen.getAllByRole("img", { name: "Mobile" })).toHaveLength(2);
	expect(browserBatch).toHaveBeenCalledTimes(1);
	expect(fetchMock).not.toHaveBeenCalled();
	expect(browserBatch.mock.calls[0][0].files).toHaveLength(4);
	fireEvent.click(retry);
	await waitFor(() => expect(browserBatch).toHaveBeenCalledTimes(2));
	expect(browserBatch.mock.calls[1][0].files).toEqual(failed.map((index) => plans[0].files[index]));
	expect(browserBatch.mock.calls[1][0].outputs.map((output: any) => output.key)).toEqual(failed.map((index) => plans[0].files[index].outputKey));
	expect(within(screen.getByRole("list", { name: "Export 2 files" })).getAllByRole("listitem")).toHaveLength(failed.length);
});

it("opens export settings without starting a download and submits only after confirmation", async () => {
	browserBatch.mockResolvedValue({ ok: false, code: "PROVIDER_UNAVAILABLE" });
	render(<ClipExport creatorId='owner' clipIds={["A"]} scope='settings' configure />);
	fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
	await screen.findByText("Export clips");
	expect(fetchMock).not.toHaveBeenCalled();
	fireEvent.click(screen.getByRole("button", { name: "Start export" }));
	await waitFor(() => expect(browserBatch).toHaveBeenCalledTimes(1));
	expect(browserBatch.mock.calls[0][0].files).toEqual([{ clipId: "A", outputKey: "original" }]);
	expect(fetchMock).not.toHaveBeenCalled();
});
it("cancels queued and active batches together without downloading more files", async () => {
	fetchMock.mockImplementation((_input, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(Error("cancelled")))));
	const Trigger = () => {
		const queue = useClipExports()!;
		return (
			<>
				<button onClick={() => queue.enqueue({ creatorId: "owner", clipIds: Array.from({ length: 51 }, (_, i) => `A${i}`), scope: "cancel", format: "zip" })}>Queue batches</button>
				<button onClick={() => queue.enqueue({ creatorId: "owner", clipIds: ["Other"], scope: "another", format: "zip" })}>Queue another</button>
			</>
		);
	};
	render(
		<ClipExportProvider creatorId='owner'>
			<Trigger />
		</ClipExportProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Queue batches" }));
	await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
	fireEvent.click(screen.getByRole("button", { name: /Cancel queued export 2/ }));
	fireEvent.click(screen.getByRole("button", { name: "Stop export" }));
	expect(screen.queryByRole("button", { name: /Cancel queued export 2/ })).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Queue another" }));
	fireEvent.click(screen.getByRole("button", { name: "Cancel export" }));
	fireEvent.click(screen.getByRole("button", { name: "Stop export" }));
	await screen.findByText("Export cancelled. Your selection is kept.");
	expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("can cancel while waiting for a quota reset and download a completed package again", async () => {
	jest.useFakeTimers();
	try {
		fetchMock.mockResolvedValueOnce(responseJSON({ code: "RATE_LIMITED", retryAt: new Date(Date.now() + 10000).toISOString() })).mockResolvedValueOnce(successResponse({ included: [0], skipped: [] }));
		Object.defineProperty(URL, "createObjectURL", { configurable: true, value: jest.fn(() => "blob:again") });
		Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
		const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
		render(<ClipExport creatorId='owner' clipIds={["A"]} scope='wait' />);
		fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
		await screen.findByText(/Waiting for the download limit/);
		fireEvent.click(screen.getByRole("button", { name: "Cancel export" }));
		expect(screen.getByRole("dialog", { name: "Cancel export?" })).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Stop export" }));
		await screen.findByText("Export cancelled. Your selection is kept.");
		fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
		await screen.findByText("1 clip ready. Download initiated.");
		fireEvent.click(screen.getByRole("button", { name: "Download ZIP" }));
		expect(click).toHaveBeenCalledTimes(2);
	} finally {
		jest.useRealTimers();
	}
});
it("expands completed batch history and downloads a retained file without contacting the provider again", async () => {
	fetchMock.mockImplementation(async () => successResponse({ included: [0], skipped: [] }));
	Object.defineProperty(URL, "createObjectURL", { configurable: true, value: jest.fn(() => "blob:history") });
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
	const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
	render(<ClipExport creatorId='owner' clipIds={["A"]} scope='history' />);
	fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
	await screen.findByText("1 clip ready. Download initiated.");
	fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
	await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
	await screen.findByRole("button", { name: "Toggle batch history" });
	fireEvent.click(screen.getByRole("button", { name: "Toggle batch history" }));
	await waitFor(() => expect(screen.getAllByText("1 clip ready. Download initiated.")).toHaveLength(2));
	fireEvent.click(screen.getByRole("button", { name: "Toggle batch history" }));
	expect(screen.getAllByText("1 clip ready. Download initiated.")).toHaveLength(1);
	fireEvent.click(screen.getByRole("button", { name: "Download ZIP" }));
	expect(click).toHaveBeenCalledTimes(3);
	expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("retries unsuccessful local outputs without exposing server recovery", async () => {
	Object.defineProperty(URL, "createObjectURL", { configurable: true, value: jest.fn(() => "blob:browser-recovery") });
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
	jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
	browserBatch.mockResolvedValueOnce({ ok: true, bytes: new Uint8Array([1]), summary: { included: [0], skipped: [{ index: 1, code: "browser_unsupported", retryable: true }] } }).mockResolvedValue({ ok: true, bytes: new Uint8Array([1]), summary: { included: [0], skipped: [] } });
	const { createClipExportPlan } = await import("@lib/clipExportPlan");
	const { createClipComposition } = await import("@lib/clipComposition");
	const plans = createClipExportPlan(
		"owner",
		["A"],
		[
			{ key: "original", label: "Original" },
			{ key: "mobile", label: "Mobile", layout: createClipComposition("mobile") },
		],
	);
	function Start() {
		const queue = useClipExports()!;
		return <button onClick={() => queue.enqueuePlans(plans, undefined, "recovery", "browser")}>Start browser export</button>;
	}
	fetchMock.mockResolvedValue(successResponse({ included: [0], skipped: [] }));
	render(
		<ClipExportProvider creatorId='owner'>
			<Start />
		</ClipExportProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Start browser export" }));
	const retry = await screen.findByRole("button", { name: "Retry failed files" });
	expect(screen.queryByRole("button", { name: "Process failed files on server" })).toBeNull();
	expect(fetchMock).not.toHaveBeenCalled();
	fireEvent.click(retry);
	await waitFor(() => expect(browserBatch).toHaveBeenCalledTimes(2));
	expect(browserBatch.mock.calls[1][0].files).toEqual([{ clipId: "A", outputKey: "mobile" }]);
});

it("resolves every matching clip before opening settings and exports that snapshot only after confirmation", async () => {
	browserBatch.mockResolvedValue({ ok: false, code: "PROVIDER_UNAVAILABLE" });
	const prepareSelection = jest.fn().mockResolvedValue({ clipIds: ["A", "B"], clipNames: { A: "First", B: "Second" } });
	render(<ClipExport creatorId='owner' clipIds={["A"]} scope='rules' configure label='Export matching clips' prepareSelection={prepareSelection} />);
	fireEvent.click(screen.getByRole("button", { name: "Export matching clips" }));
	await screen.findByText("Export clips");
	expect(prepareSelection).toHaveBeenCalledTimes(1);
	expect(browserBatch).not.toHaveBeenCalled();
	fireEvent.click(screen.getByRole("button", { name: "Start export" }));
	await waitFor(() => expect(browserBatch).toHaveBeenCalledTimes(1));
	expect(browserBatch.mock.calls[0][0].files.map((file: any) => file.clipId)).toEqual(["A", "B"]);
});

it.each(["empty", "denied", "failure"])("keeps matching-export settings closed after %s preparation and permits retry", async (kind) => {
	const prepareSelection = jest.fn();
	if (kind === "failure") prepareSelection.mockRejectedValueOnce(Error("offline"));
	else prepareSelection.mockResolvedValueOnce(kind === "empty" ? { clipIds: [] } : undefined);
	prepareSelection.mockResolvedValue({ clipIds: ["A"] });
	render(<ClipExport creatorId='owner' clipIds={["A"]} scope='rules-recovery' configure label='Export matching clips' prepareSelection={prepareSelection} />);
	fireEvent.click(screen.getByRole("button", { name: "Export matching clips" }));
	await waitFor(() => expect(prepareSelection).toHaveBeenCalledTimes(1));
	if (kind !== "denied") await waitFor(() => expect(notify).toHaveBeenCalled());
	expect(screen.queryByText("Export clips")).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "Export matching clips" }));
	await screen.findByText("Export clips");
	expect(browserBatch).not.toHaveBeenCalled();
});
it("renders a direct layout MP4 locally instead of posting it to the server", async () => {
	const { defaultClipLayout } = await import("@lib/clipLayout");
	Object.defineProperty(URL, "createObjectURL", { configurable: true, value: jest.fn(() => "blob:local-mp4") });
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
	jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
	render(<ClipExport creatorId='owner' clipIds={["A"]} scope='direct-layout' format='mp4' layout={defaultClipLayout} />);
	fireEvent.click(screen.getByRole("button", { name: "Download portrait" }));
	await waitFor(() => expect(browserBatch).toHaveBeenCalledTimes(1));
	expect(browserBatch.mock.calls[0][0].outputs[0].layout).toEqual(defaultClipLayout);
	expect(browserBatch.mock.calls[0].at(-1)).toBe("mp4");
	expect(fetchMock).not.toHaveBeenCalled();
	await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
	expect((URL.createObjectURL as jest.Mock).mock.calls[0][0].type).toBe("video/mp4");
});

it("keeps archive waiting and per-file progress visible until the single download is complete", async () => {
	const { ClipExportProvider, useClipExports } = jest.requireActual("@components/creator/clipExportQueue");
	const { createClipExportPlan } = jest.requireActual("@lib/clipExportPlan");
	let report: any, waiting: any, finish: any;
	diskArchive.mockImplementationOnce((plans, startedAt, signal, onProgress, onWaiting) => {
		report = onProgress;
		waiting = onWaiting;
		return new Promise((resolve) => {
			finish = resolve;
		});
	});
	function Queue() {
		const queue = useClipExports();
		return <button onClick={() => queue.enqueuePlans(createClipExportPlan("owner", ["A", "B"], [{ key: "original", label: "Original" }]), undefined, "progress")}>Queue archive</button>;
	}
	render(
		<ClipExportProvider creatorId='owner'>
			<Queue />
		</ClipExportProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Queue archive" }));
	await waitFor(() => expect(report).toBeDefined());
	await import("@testing-library/react").then(({ act }) =>
		act(async () => {
			waiting(new Date(Date.now() + 60000).toISOString());
			report({ index: 0, stage: "rendering" });
		}),
	);
	expect(screen.getByText("Rendering video")).toBeVisible();
	const leaving = new Event("beforeunload", { cancelable: true });
	window.dispatchEvent(leaving);
	expect(leaving.defaultPrevented).toBe(true);
	await import("@testing-library/react").then(({ act }) =>
		act(async () => {
			waiting();
			report({ index: 0, stage: "ready" });
			finish({ ok: true, bytes: new Uint8Array([1]), dispose: releaseArchive, summary: { included: [0], skipped: [{ index: 1, code: "clip_unavailable", retryable: false }] } });
		}),
	);
	await screen.findByRole("button", { name: "Download ZIP" });
	expect(screen.getByText("Ready")).toBeVisible();
	const finished = new Event("beforeunload", { cancelable: true });
	window.dispatchEvent(finished);
	expect(finished.defaultPrevented).toBe(false);
});
it("does not break export controls when abandoned-cache cleanup is unavailable", async () => {
	cleanupDisk.mockRejectedValueOnce(Error("storage blocked"));
	render(<ClipExport creatorId='owner' clipIds={["A"]} scope='owner' />);
	await waitFor(() => expect(cleanupDisk).toHaveBeenCalled());
	expect(screen.getByRole("button", { name: "Export selected" })).toBeEnabled();
});

it.each([1, 2])("exports %i versions of one clip with the correct file type and single-video preview", async (count) => {
	const { createClipExportPlan } = await import("@lib/clipExportPlan");
	const plans = createClipExportPlan(
		"owner",
		["A"],
		Array.from({ length: count }, (_, i) => ({ key: `version${i}`, label: `Version ${i}` })),
	);
	const Trigger = () => {
		const queue = useClipExports()!;
		return <button onClick={() => queue.enqueuePlans(plans, { A: "My clip" }, "single")}>Queue versions</button>;
	};
	Object.defineProperty(URL, "createObjectURL", { configurable: true, value: jest.fn(() => "blob:video") });
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
	const download = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
	render(
		<ClipExportProvider creatorId='owner'>
			<Trigger />
		</ClipExportProvider>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Queue versions" }));
	await screen.findByRole("button", { name: count === 1 ? "Download MP4" : "Download ZIP" });
	expect(download).toHaveBeenCalledTimes(1);
	expect(browserBatch.mock.calls[0][4]).toBe(count === 1 ? "mp4" : "zip");
	const video = screen.queryByLabelText("Exported video");
	if (count === 1) {
		expect(video).toHaveAttribute("src", "blob:video");
		expect(video).toHaveAttribute("draggable", "false");
		expect(fireEvent.dragStart(video!)).toBe(false);
		expect(screen.queryByText(/Drag the video/)).toBeNull();
		expect(screen.getByText(/Download initiated/)).toBeVisible();
		fireEvent.click(screen.getByRole("button", { name: "Download MP4" }));
		expect(download).toHaveBeenCalledTimes(2);
		expect(diskArchive).not.toHaveBeenCalled();
	} else expect(video).toBeNull();
});
