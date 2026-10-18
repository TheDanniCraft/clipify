import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import RunnerBrandingPreview from "@/app/components/runner/RunnerBrandingPreview";
import { getRunnerBrandingProfile, saveRunnerBrandingProfile } from "@/app/actions/runner";

jest.mock("@/app/actions/runner", () => ({ getRunnerBrandingProfile: jest.fn(), saveRunnerBrandingProfile: jest.fn() }));

// Unit owner checks draft transport and upload/save handling; real widgets are browser-owned.
jest.mock("@/app/components/runner/ImageDropZone", () => ({ __esModule: true, default: ({ label, disabled, onSelect }: { label: string; disabled: boolean; onSelect: (file: File) => void }) => <input type='file' aria-label={label} disabled={disabled} onChange={(event) => onSelect(event.target.files![0])} /> }));
jest.mock("@/app/components/theme/ThemeColorInput", () => ({ __esModule: true, default: ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => <input type='color' aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} /> }));
const previewMessages = new WeakMap<HTMLIFrameElement, jest.SpyInstance>();
async function observeDraftPreview() {
	const frame = (await screen.findByTitle("Runner appearance preview")) as HTMLIFrameElement;
	if (!previewMessages.has(frame)) previewMessages.set(frame, jest.spyOn(frame.contentWindow!, "postMessage"));
	fireEvent.load(frame);
	return frame;
}
function acknowledgePreview(frame: HTMLIFrameElement) {
	const stamp = frame.contentDocument!.createElement("div");
	stamp.setAttribute("data-runner-preview-revision", previewMessages.get(frame)?.mock.calls.at(-1)?.[0]?.revision ?? "");
	frame.contentDocument!.body.append(stamp);
}
function draftQuery(frame: HTMLIFrameElement) {
	const message = previewMessages.get(frame)?.mock.calls.at(-1)?.[0];
	return {
		get: (key: string) => {
			const value = message?.draft?.[key];
			return value == null ? "" : String(value);
		},
	};
}

let originalResize: PropertyDescriptor | undefined;
beforeAll(() => {
	originalResize = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
	Reflect.set(
		globalThis,
		"ResizeObserver",
		class {
			constructor(callback: ResizeObserverCallback) {
				this.observe = jest.fn(() => callback([{ contentRect: { width: 360 } }] as ResizeObserverEntry[], this as unknown as ResizeObserver));
			}
			observe = jest.fn();
			unobserve = jest.fn();
			disconnect = jest.fn();
		},
	);
});
afterAll(() => {
	if (originalResize) Object.defineProperty(globalThis, "ResizeObserver", originalResize);
	else Reflect.deleteProperty(globalThis, "ResizeObserver");
});

const profile = { id: null, watermarkCorner: "bottom_right" as const, proShowAttribution: false, standbyBackgroundColor: "#000000", backgroundAssetId: null, logoAssetId: null, message: "", showNextBroadcastTime: false, revision: 0 };

test("TDD-US4-DEC012: an unfinished preview refuses persistence and gives a normal retry message", async () => {
	jest.mocked(getRunnerBrandingProfile).mockResolvedValue({ success: true, profile, runnerPro: false });
	jest.mocked(saveRunnerBrandingProfile).mockResolvedValue({ success: true, profile: { ...profile, id: "33333333-3333-4333-8333-333333333333", revision: 1 } });
	render(<RunnerBrandingPreview ownerId='fixture-owner' runnerId='11111111-1111-4111-8111-111111111111' overlayId='22222222-2222-4222-8222-222222222222' />);
	const frame = (await observeDraftPreview()) as HTMLIFrameElement;
	const document = frame.contentDocument!;
	document.open();
	document.write('<html><body><div data-runner-presentation-generation="preview-11111111-1111-4111-8111-111111111111" data-runner-layout-status="pending"></div></body></html>');
	document.close();
	acknowledgePreview(frame);
	const save = screen.getByRole("button", { name: "Save appearance" });
	await waitFor(() => expect(save).toBeEnabled());
	jest.useFakeTimers();
	try {
		fireEvent.click(save);
		expect(saveRunnerBrandingProfile).not.toHaveBeenCalled();
		await act(async () => {
			await jest.advanceTimersByTimeAsync(5000);
		});
		expect(screen.getByRole("alert")).toHaveTextContent("Wait for the appearance preview to finish loading");
		expect(saveRunnerBrandingProfile).not.toHaveBeenCalled();
		expect(save).toBeEnabled();
	} finally {
		jest.useRealTimers();
	}
});

beforeEach(() => jest.clearAllMocks());

async function previewWithLayout(status: "placed" | "clean" | "blocked") {
	jest.mocked(getRunnerBrandingProfile).mockResolvedValue({ success: true, profile, runnerPro: false });
	render(<RunnerBrandingPreview ownerId='fixture-owner' runnerId='11111111-1111-4111-8111-111111111111' overlayId='22222222-2222-4222-8222-222222222222' />);
	const frame = (await observeDraftPreview()) as HTMLIFrameElement;
	const document = frame.contentDocument!;
	document.open();
	document.write(`<html><body><div data-runner-presentation-generation="preview-11111111-1111-4111-8111-111111111111" data-runner-layout-status="${status}"></div></body></html>`);
	document.close();
	acknowledgePreview(frame);
	expect(document.URL).toBe(frame.src);
	const save = screen.getByRole("button", { name: "Save appearance" });
	await waitFor(() => expect(save).toBeEnabled());
	return { frame, save };
}

test("TDD-US4-DEC012: a measured blocked layout refuses persistence with its actionable layout error", async () => {
	const { save } = await previewWithLayout("blocked");
	fireEvent.click(save);
	expect(await screen.findByRole("alert")).toHaveTextContent("Adjust your overlay layout to leave room for Clipify attribution before saving.");
	expect(saveRunnerBrandingProfile).not.toHaveBeenCalled();
	expect(save).toBeEnabled();
});

test.each(["placed", "clean"] as const)("TDD-US4-FR017: a %s preview saves its expected revision once and acknowledges success", async (status) => {
	jest.mocked(saveRunnerBrandingProfile).mockResolvedValue({ success: true, profile: { ...profile, id: "33333333-3333-4333-8333-333333333333", revision: 1 } });
	const { save } = await previewWithLayout(status);
	fireEvent.click(save);
	expect(await screen.findByRole("status")).toHaveTextContent("Appearance saved");
	expect(saveRunnerBrandingProfile).toHaveBeenCalledTimes(1);
	expect(saveRunnerBrandingProfile).toHaveBeenCalledWith({ ownerId: "fixture-owner", runnerId: "11111111-1111-4111-8111-111111111111", expectedRevision: 0, watermarkCorner: "bottom_right" });
	expect(save).toBeEnabled();
});

test.each(["conflict", "transport"])("TDD-US4-FR017: a %s save failure preserves the displayed revision for a normal retry", async (failure) => {
	const saved = { success: true as const, profile: { ...profile, id: "33333333-3333-4333-8333-333333333333", revision: 1 } };
	jest.mocked(saveRunnerBrandingProfile).mockResolvedValue(saved);
	if (failure === "conflict") jest.mocked(saveRunnerBrandingProfile).mockResolvedValueOnce({ success: false, code: "CONFLICT", error: "Appearance changed. Reload and try again." });
	else jest.mocked(saveRunnerBrandingProfile).mockRejectedValueOnce(new Error("fixture transport unavailable"));
	const { save } = await previewWithLayout("placed");
	fireEvent.click(save);
	expect(await screen.findByRole("alert")).toHaveTextContent(failure === "conflict" ? "Appearance changed. Reload and try again." : "Could not save appearance. Please try again.");
	expect(screen.queryByRole("status")).not.toBeInTheDocument();
	expect(save).toBeEnabled();
	fireEvent.click(save);
	expect(await screen.findByRole("status")).toHaveTextContent("Appearance saved");
	expect(saveRunnerBrandingProfile).toHaveBeenNthCalledWith(2, { ownerId: "fixture-owner", runnerId: "11111111-1111-4111-8111-111111111111", expectedRevision: 0, watermarkCorner: "bottom_right" });
});

test.each(["denied", "transport"])("TDD-US4-FR017: a %s load failure shows a normal error and disables persistence", async (failure) => {
	if (failure === "denied") jest.mocked(getRunnerBrandingProfile).mockResolvedValue({ success: false, code: "ACCESS_DENIED", error: "Access denied" });
	else jest.mocked(getRunnerBrandingProfile).mockRejectedValue(new Error("fixture load unavailable"));
	render(<RunnerBrandingPreview ownerId='fixture-owner' runnerId='11111111-1111-4111-8111-111111111111' overlayId='22222222-2222-4222-8222-222222222222' />);
	expect(await screen.findByRole("alert")).toHaveTextContent(failure === "denied" ? "Access denied" : "Could not load appearance. Please try again.");
	expect(screen.getByRole("button", { name: "Save appearance" })).toBeDisabled();
	expect(screen.queryByTitle("Runner appearance preview")).not.toBeInTheDocument();
	expect(saveRunnerBrandingProfile).not.toHaveBeenCalled();
});

test.each([
	["720p", 1280, 720],
	["1080p", 1920, 1080],
] as const)("TDD-US4-DEC012: resizing a %s preview preserves its broadcast canvas at mobile width", async (resolution, width, height) => {
	jest.mocked(getRunnerBrandingProfile).mockResolvedValue({ success: true, profile, runnerPro: false });
	render(<RunnerBrandingPreview ownerId='fixture-owner' runnerId='11111111-1111-4111-8111-111111111111' overlayId='22222222-2222-4222-8222-222222222222' resolution={resolution} />);
	const frame = await observeDraftPreview();
	await waitFor(() => expect(frame).toHaveStyle({ width: `${width}px`, height: `${height}px`, transform: `scale(${360 / width})`, "transform-origin": "top left" }));
});

test("TDD-US4-OPT093 U133: a draft Pro attribution choice refreshes the real preview before persistence", async () => {
	jest.mocked(getRunnerBrandingProfile).mockResolvedValue({ success: true, profile, runnerPro: true });
	render(<RunnerBrandingPreview ownerId='fixture-owner' runnerId='11111111-1111-4111-8111-111111111111' overlayId='22222222-2222-4222-8222-222222222222' />);
	const choice = await screen.findByRole("switch", { name: "Show Clipify attribution" });
	expect(choice).not.toBeChecked();
	fireEvent.click(choice);
	expect(choice).toBeChecked();
	const frame = (await observeDraftPreview()) as HTMLIFrameElement;
	expect(draftQuery(frame).get("proShowAttribution")).toBe("true");
	expect(saveRunnerBrandingProfile).not.toHaveBeenCalled();
});

test("TDD-US4-SC004 U39: real preview controls switch only the owner iframe without saving broadcast configuration", async () => {
	jest.mocked(getRunnerBrandingProfile).mockResolvedValue({ success: true, profile, runnerPro: true });
	render(<RunnerBrandingPreview ownerId='fixture-owner' runnerId='11111111-1111-4111-8111-111111111111' overlayId='22222222-2222-4222-8222-222222222222' />);
	await observeDraftPreview();
	fireEvent.click(screen.getByRole("button", { name: "Preview clips" }));
	let frame = screen.getByTitle("Runner appearance preview") as HTMLIFrameElement;
	expect(draftQuery(frame).get("previewMode")).toBe("playback");
	fireEvent.click(screen.getByRole("button", { name: "Preview standby" }));
	frame = screen.getByTitle("Runner appearance preview") as HTMLIFrameElement;
	expect(draftQuery(frame).get("previewMode")).toBe("standby");
	expect(saveRunnerBrandingProfile).not.toHaveBeenCalled();
});
test("TDD-US4-SC004 U39: clearing optional images changes draft preview references while retaining saved text and color until Apply", async () => {
	const saved = { ...profile, id: "33333333-3333-4333-8333-333333333333", revision: 1, backgroundAssetId: "44444444-4444-4444-8444-444444444444", logoAssetId: "55555555-5555-4555-8555-555555555555", message: "Keep this message", standbyBackgroundColor: "#16324f" };
	jest.mocked(getRunnerBrandingProfile).mockResolvedValue({ success: true, profile: saved, runnerPro: true });
	render(<RunnerBrandingPreview ownerId='fixture-owner' runnerId='11111111-1111-4111-8111-111111111111' overlayId='22222222-2222-4222-8222-222222222222' />);
	await observeDraftPreview();
	fireEvent.click(screen.getByRole("button", { name: "Remove logo" }));
	fireEvent.click(screen.getByRole("button", { name: "Remove background image" }));
	const frame = screen.getByTitle("Runner appearance preview") as HTMLIFrameElement;
	const query = draftQuery(frame);
	expect(query.get("logoAssetId")).toBe("");
	expect(query.get("backgroundAssetId")).toBe("");
	expect(query.get("message")).toBe(saved.message);
	expect(query.get("standbyBackgroundColor")).toBe(saved.standbyBackgroundColor);
	expect(saveRunnerBrandingProfile).not.toHaveBeenCalled();
});

test("TDD-US4-FR019 strength: Pro edits and staged images reach preview before one revision-checked appearance save", async () => {
	const backgroundAssetId = "44444444-4444-4444-8444-444444444444";
	const logoAssetId = "55555555-5555-4555-8555-555555555555";
	const updated = { ...profile, id: "33333333-3333-4333-8333-333333333333", revision: 1, standbyBackgroundColor: "#2f4f6f", message: "Community break", backgroundAssetId, logoAssetId, showNextBroadcastTime: true };
	jest.mocked(getRunnerBrandingProfile).mockResolvedValue({ success: true, profile, runnerPro: true });
	jest.mocked(saveRunnerBrandingProfile).mockResolvedValue({ success: true, profile: updated });
	const previousFetch = globalThis.fetch;
	const upload = jest
		.fn()
		.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, asset: { id: backgroundAssetId } }) })
		.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, asset: { id: logoAssetId } }) });
	Reflect.set(globalThis, "fetch", upload);
	try {
		render(<RunnerBrandingPreview ownerId='fixture-owner' runnerId='11111111-1111-4111-8111-111111111111' overlayId='22222222-2222-4222-8222-222222222222' />);
		await observeDraftPreview();
		fireEvent.change(screen.getByLabelText("Standby background color"), { target: { value: updated.standbyBackgroundColor } });
		fireEvent.change(screen.getByLabelText("Standby message"), { target: { value: updated.message } });
		fireEvent.click(screen.getByRole("switch", { name: "Show next broadcast time" }));
		const file = new File(["controlled-upload"], "standby.png", { type: "image/png" });
		fireEvent.change(screen.getByLabelText("Standby background image"), { target: { files: [file] } });
		await waitFor(() => expect(draftQuery(screen.getByTitle("Runner appearance preview") as HTMLIFrameElement).get("backgroundAssetId")).toBe(backgroundAssetId));
		fireEvent.change(screen.getByLabelText("Standby logo"), { target: { files: [file] } });
		await waitFor(() => expect(draftQuery(screen.getByTitle("Runner appearance preview") as HTMLIFrameElement).get("logoAssetId")).toBe(logoAssetId));
		const frame = screen.getByTitle("Runner appearance preview") as HTMLIFrameElement;
		const query = draftQuery(frame);
		expect(query.get("message")).toBe(updated.message);
		expect(query.get("standbyBackgroundColor")).toBe(updated.standbyBackgroundColor);
		expect(query.get("showNextBroadcastTime")).toBe("true");
		expect(saveRunnerBrandingProfile).not.toHaveBeenCalled();
		expect(upload).toHaveBeenNthCalledWith(1, expect.stringContaining("kind=background"), { method: "POST", credentials: "same-origin", body: file });
		expect(upload).toHaveBeenNthCalledWith(2, expect.stringContaining("kind=logo"), { method: "POST", credentials: "same-origin", body: file });
		frame.contentDocument!.open();
		frame.contentDocument!.write('<html><body><div data-runner-presentation-generation="preview-11111111-1111-4111-8111-111111111111" data-runner-layout-status="clean"></div></body></html>');
		frame.contentDocument!.close();
		acknowledgePreview(frame);
		fireEvent.click(screen.getByRole("button", { name: "Save appearance" }));
		expect(await screen.findByRole("status")).toHaveTextContent("Appearance saved");
		expect(saveRunnerBrandingProfile).toHaveBeenCalledTimes(1);
		expect(saveRunnerBrandingProfile).toHaveBeenCalledWith({ ownerId: "fixture-owner", runnerId: "11111111-1111-4111-8111-111111111111", expectedRevision: 0, watermarkCorner: "bottom_right", proShowAttribution: false, standbyBackgroundColor: updated.standbyBackgroundColor, backgroundAssetId, logoAssetId, message: updated.message, showNextBroadcastTime: true });
	} finally {
		Reflect.set(globalThis, "fetch", previousFetch);
	}
});

test.each(["validation", "missing error text", "malformed success", "transport"])("TDD-US4-EC012 strength: %s upload failure preserves the current preview and the next saved asset reference", async (failure) => {
	const saved = { ...profile, id: "33333333-3333-4333-8333-333333333333", revision: 3, backgroundAssetId: "44444444-4444-4444-8444-444444444444", message: "Keep this scene", standbyBackgroundColor: "#16324f" };
	jest.mocked(getRunnerBrandingProfile).mockResolvedValue({ success: true, profile: saved, runnerPro: true });
	jest.mocked(saveRunnerBrandingProfile).mockResolvedValue({ success: true, profile: { ...saved, revision: 4 } });
	const previousFetch = globalThis.fetch;
	const upload = jest.fn();
	if (failure === "transport") upload.mockRejectedValue(new Error("PRIVATE_UPLOAD_FAILURE"));
	else upload.mockResolvedValue({ ok: failure === "malformed success", json: async () => (failure === "validation" ? { success: false, error: "The image could not be saved." } : failure === "missing error text" ? { success: false } : { success: true, asset: { id: 42 } }) });
	Reflect.set(globalThis, "fetch", upload);
	try {
		render(<RunnerBrandingPreview ownerId='fixture-owner' runnerId='11111111-1111-4111-8111-111111111111' overlayId='22222222-2222-4222-8222-222222222222' />);
		const frame = (await observeDraftPreview()) as HTMLIFrameElement;
		const originalUrl = frame.src;
		fireEvent.change(screen.getByLabelText("Standby background image"), { target: { files: [new File(["fixture"], "standby.png", { type: "image/png" })] } });
		const error = await screen.findByRole("alert");
		expect(error).toHaveTextContent(failure === "validation" ? "The image could not be saved." : "Could not upload the image.");
		expect(error).not.toHaveTextContent("PRIVATE_UPLOAD_FAILURE");
		expect(screen.getByTitle("Runner appearance preview")).toBe(frame);
		expect(frame.src).toBe(originalUrl);
		expect(screen.getByLabelText("Standby message")).toHaveValue(saved.message);
		frame.contentDocument!.open();
		frame.contentDocument!.write('<html><body><div data-runner-presentation-generation="preview-11111111-1111-4111-8111-111111111111" data-runner-layout-status="clean"></div></body></html>');
		frame.contentDocument!.close();
		acknowledgePreview(frame);
		fireEvent.click(screen.getByRole("button", { name: "Save appearance" }));
		expect(await screen.findByRole("status")).toHaveTextContent("Appearance saved");
		expect(saveRunnerBrandingProfile).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 3, backgroundAssetId: saved.backgroundAssetId, message: saved.message, standbyBackgroundColor: saved.standbyBackgroundColor }));
	} finally {
		Reflect.set(globalThis, "fetch", previousFetch);
	}
});

test.each(["cancelled", "oversized"])("TDD-US4-EC012 strength: a %s file selection keeps the saved scene and does not start an upload", async (selection) => {
	jest.mocked(getRunnerBrandingProfile).mockResolvedValue({ success: true, profile: { ...profile, message: "Saved scene" }, runnerPro: true });
	const previousFetch = globalThis.fetch;
	const upload = jest.fn();
	Reflect.set(globalThis, "fetch", upload);
	try {
		render(<RunnerBrandingPreview ownerId='fixture-owner' runnerId='11111111-1111-4111-8111-111111111111' overlayId='22222222-2222-4222-8222-222222222222' />);
		const frame = (await observeDraftPreview()) as HTMLIFrameElement;
		const originalUrl = frame.src;
		fireEvent.change(screen.getByLabelText("Standby logo"), { target: { files: selection === "cancelled" ? [] : [new File([new Uint8Array(2097153)], "large.png", { type: "image/png" })] } });
		if (selection === "oversized") expect(await screen.findByRole("alert")).toHaveTextContent("Images must be no larger than 2 MiB.");
		expect(upload).not.toHaveBeenCalled();
		expect(frame.src).toBe(originalUrl);
		expect(screen.getByLabelText("Standby message")).toHaveValue("Saved scene");
		expect(saveRunnerBrandingProfile).not.toHaveBeenCalled();
	} finally {
		Reflect.set(globalThis, "fetch", previousFetch);
	}
});

test("UX-C4: editing the standby message keeps the same preview document", async () => {
	jest.mocked(getRunnerBrandingProfile).mockResolvedValue({ success: true, profile, runnerPro: true });
	render(<RunnerBrandingPreview ownerId='fixture-owner' runnerId='11111111-1111-4111-8111-111111111111' overlayId='22222222-2222-4222-8222-222222222222' />);
	const frame = await observeDraftPreview();
	const src = frame.getAttribute("src");
	fireEvent.change(screen.getByRole("textbox", { name: "Standby message" }), { target: { value: "Back soon" } });
	expect(screen.getByTitle("Runner appearance preview")).toBe(frame);
	expect(frame).toHaveAttribute("src", src);
});
