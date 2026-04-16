import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ControllerClient from "@/app/controller/[overlayId]/controllerClient";

const getControllerQueuesAction = jest.fn();
const runControllerAction = jest.fn();

jest.mock("@actions/controller", () => ({
	getControllerQueuesAction: (...args: unknown[]) => getControllerQueuesAction(...args),
	runControllerAction: (...args: unknown[]) => runControllerAction(...args),
}));

jest.mock("@tabler/icons-react", () => ({
	IconBroadcast: () => <span>broadcast-icon</span>,
	IconLock: () => <span>lock-icon</span>,
	IconLockOpen2: () => <span>unlock-icon</span>,
	IconEye: () => <span>show-icon</span>,
	IconEyeOff: () => <span>hide-icon</span>,
	IconLayoutSidebarRightExpand: () => <span>layout-icon</span>,
	IconPlayerSkipForward: () => <span>skip-icon</span>,
	IconPlayerPauseFilled: () => <span>pause-icon</span>,
	IconPlayerPlayFilled: () => <span>play-icon</span>,
	IconPlus: () => <span>plus-icon</span>,
	IconVolume: () => <span>volume-icon</span>,
	IconVolumeOff: () => <span>volume-off-icon</span>,
}));

jest.mock("@heroui/react", () => ({
	Button: ({ children, onPress, isDisabled, isIconOnly: _isIconOnly, radius: _radius, variant: _variant, color: _color, ...props }: { children?: React.ReactNode; onPress?: () => void; isDisabled?: boolean; isIconOnly?: boolean; radius?: string; variant?: string; color?: string }) => (
		<button {...props} disabled={isDisabled} onClick={() => onPress?.()}>
			{children}
		</button>
	),
	Chip: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	Image: ({ alt = "", src }: { alt?: string; src?: string }) => <img alt={alt} src={src} />,
	Progress: ({ value, "aria-label": ariaLabel }: { value?: number; "aria-label"?: string }) => <progress aria-label={ariaLabel} value={value} max={100} />,
	Slider: ({ value, onChange, onChangeEnd, isDisabled, "aria-label": ariaLabel }: { value?: number; onChange?: (value: number) => void; onChangeEnd?: (value: number) => void; isDisabled?: boolean; "aria-label"?: string }) => (
		<input
			type='range'
			aria-label={ariaLabel}
			disabled={isDisabled}
			value={value}
			onChange={(event) => onChange?.(Number(event.target.value))}
			onBlur={(event) => onChangeEnd?.(Number(event.target.value))}
		/>
	),
}));

type SocketListener = (event: { data?: string; type?: string }) => void;

class MockWebSocket {
	static instances: MockWebSocket[] = [];
	static OPEN = 1;
	readyState = 1;
	url: string;
	send = jest.fn();
	close = jest.fn();
	private listeners = new Map<string, SocketListener[]>();

	constructor(url: string) {
		this.url = url;
		MockWebSocket.instances.push(this);
	}

	addEventListener(type: string, listener: SocketListener) {
		const existing = this.listeners.get(type) ?? [];
		existing.push(listener);
		this.listeners.set(type, existing);
	}

	emit(type: string, event: { data?: string; type?: string }) {
		for (const listener of this.listeners.get(type) ?? []) {
			listener(event);
		}
	}
}

async function emitSocketOpen(ws: MockWebSocket | undefined) {
	await act(async () => {
		ws?.emit("open", { type: "open" });
	});
}

async function emitSocketClose(ws: MockWebSocket | undefined) {
	await act(async () => {
		ws?.emit("close", { type: "close" });
	});
}

async function emitSocketError(ws: MockWebSocket | undefined) {
	await act(async () => {
		ws?.emit("error", { type: "error" });
	});
}

async function emitSocketMessage(ws: MockWebSocket | undefined, payload: unknown) {
	await act(async () => {
		ws?.emit("message", { data: JSON.stringify(payload) });
	});
}

function getButtonByText(text: string, index = 0) {
	return screen.getAllByText(text)[index].closest("button") as HTMLButtonElement;
}

describe("controller/[overlayId]/controllerClient", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		MockWebSocket.instances = [];
		Object.defineProperty(document, "readyState", { configurable: true, value: "complete" });
		Object.defineProperty(window, "WebSocket", { configurable: true, value: MockWebSocket });
		Object.defineProperty(globalThis, "WebSocket", { configurable: true, value: MockWebSocket });
		getControllerQueuesAction.mockResolvedValue({ overlayId: "ov-1", modQueue: [], viewerQueue: [] });
		runControllerAction.mockResolvedValue({ ok: true });
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("subscribes with the controller token and loads queues", async () => {
		render(<ControllerClient overlayId='ov-1' controllerToken='signed-token' />);

		const ws = MockWebSocket.instances[0];
		await emitSocketOpen(ws);

		expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "subscribe", data: { overlayId: "ov-1", controllerToken: "signed-token", role: "controller" } }));
		await waitFor(() => expect(getControllerQueuesAction).toHaveBeenCalledWith("ov-1"));
		expect(screen.getByText("Controls locked")).toBeInTheDocument();
	});

	it("sends play, hide, skip, mute, and unmute commands after unlocking", async () => {
		render(<ControllerClient overlayId='ov-1' controllerToken='signed-token' />);
		const ws = MockWebSocket.instances[0];
		await emitSocketOpen(ws);
		await emitSocketMessage(ws, { type: "overlay_state", data: { kind: "playback_state", paused: false, showPlayer: true, volume: 25, muted: false } });

		fireEvent.click(getButtonByText("lock-icon"));
		await screen.findByText("Controls unlocked");
		fireEvent.click(getButtonByText("hide-icon"));
		fireEvent.click(getButtonByText("volume-icon", 0));
		fireEvent.click(getButtonByText("pause-icon"));
		fireEvent.click(getButtonByText("skip-icon"));

		expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "command", data: { name: "hide", data: null, overlayId: "ov-1" } }));
		expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "command", data: { name: "mute", data: null, overlayId: "ov-1" } }));
		expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "command", data: { name: "pause", data: null, overlayId: "ov-1" } }));
		expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "command", data: { name: "skip", data: null, overlayId: "ov-1" } }));

		await emitSocketMessage(ws, { type: "overlay_state", data: { kind: "playback_state", paused: true, showPlayer: false, volume: 0, muted: true } });
		fireEvent.click(getButtonByText("volume-off-icon"));

		await waitFor(() => expect(runControllerAction).toHaveBeenCalledWith("ov-1", { action: "set_volume", volume: 1, clipUrl: undefined }));
		expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "command", data: { name: "unmute", data: null, overlayId: "ov-1" } }));
	});

	it("keeps transport commands locked until the operator unlocks controls", async () => {
		render(<ControllerClient overlayId='ov-1' controllerToken='signed-token' />);
		const ws = MockWebSocket.instances[0];
		await emitSocketOpen(ws);
		await emitSocketMessage(ws, { type: "overlay_state", data: { kind: "playback_state", paused: false, showPlayer: true, volume: 25, muted: false } });

		fireEvent.click(getButtonByText("hide-icon"));
		fireEvent.click(getButtonByText("volume-icon", 0));
		fireEvent.click(getButtonByText("pause-icon"));
		fireEvent.click(getButtonByText("skip-icon"));

		expect(ws.send).toHaveBeenCalledTimes(1);
		expect(runControllerAction).not.toHaveBeenCalled();
	});

	it("submits volume, add-clip, and clear queue actions", async () => {
		runControllerAction.mockResolvedValue({ ok: true });
		render(<ControllerClient overlayId='ov-1' controllerToken='signed-token' />);
		const ws = MockWebSocket.instances[0];
		await emitSocketOpen(ws);
		await emitSocketMessage(ws, {
			type: "overlay_state",
			data: {
				kind: "playback_state",
				paused: false,
				showPlayer: true,
				volume: 40,
				muted: false,
			},
		});

		fireEvent.click(getButtonByText("lock-icon"));
		await screen.findByText("Controls unlocked");

		const slider = screen.getByLabelText("Set volume");
		fireEvent.change(slider, { target: { value: "77" } });
		fireEvent.blur(slider, { target: { value: "77" } });

		await waitFor(() => expect(runControllerAction).toHaveBeenCalledWith("ov-1", { action: "set_volume", volume: 77, clipUrl: undefined }));

		fireEvent.change(screen.getByLabelText("Mod queue clip URL"), { target: { value: "https://clips.twitch.tv/abc" } });
		fireEvent.click(screen.getByText("Add clip"));

		await waitFor(() => expect(runControllerAction).toHaveBeenCalledWith("ov-1", { action: "add_mod_clip", volume: undefined, clipUrl: "https://clips.twitch.tv/abc" }));
		expect(await screen.findByText("Clip added to mod queue.")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Clear mods" }));
		fireEvent.click(screen.getByRole("button", { name: "Clear viewers" }));
		fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

		await waitFor(() => {
			expect(runControllerAction).toHaveBeenCalledWith("ov-1", { action: "clear_mod_queue", volume: undefined, clipUrl: undefined });
			expect(runControllerAction).toHaveBeenCalledWith("ov-1", { action: "clear_viewer_queue", volume: undefined, clipUrl: undefined });
			expect(runControllerAction).toHaveBeenCalledWith("ov-1", { action: "clear_all_queues", volume: undefined, clipUrl: undefined });
		});
	});

	it("renders queue/state updates and add-clip errors", async () => {
		getControllerQueuesAction.mockResolvedValue({
			overlayId: "ov-1",
			modQueue: [{ clipId: "mod-1", title: "Mod One", creatorName: "alice", duration: 11, thumbnailUrl: null }],
			viewerQueue: [{ clipId: "viewer-1", title: "Viewer One", creatorName: "bob", duration: 12, thumbnailUrl: null }],
		});
		runControllerAction.mockResolvedValueOnce({ ok: false, error: "Unable to add clip.", status: 400 });
		render(<ControllerClient overlayId='ov-1' controllerToken='signed-token' />);
		const ws = MockWebSocket.instances[0];
		await emitSocketOpen(ws);
		await emitSocketMessage(ws, {
			type: "overlay_state",
			data: {
				kind: "heartbeat",
				playerAttached: true,
			},
		});
		await emitSocketMessage(ws, {
			type: "overlay_state",
			data: {
				kind: "now_playing",
				clipId: "clip-1",
				title: "Current Clip",
				creatorName: "alice",
				duration: 30,
				currentTime: 5,
				thumbnailUrl: null,
			},
		});
		await emitSocketMessage(ws, {
			type: "overlay_state",
			data: {
				kind: "queue_preview",
				items: [{ clipId: "next-1", title: "Next Clip", creatorName: "bob", duration: 20, thumbnailUrl: null }],
			},
		});

		expect(screen.getByText("Mod One")).toBeInTheDocument();
		expect(screen.getByText("Viewer One")).toBeInTheDocument();
		fireEvent.click(getButtonByText("lock-icon"));
		await screen.findByText("Controls unlocked");
		fireEvent.change(screen.getByLabelText("Mod queue clip URL"), { target: { value: "https://clips.twitch.tv/error" } });
		fireEvent.click(screen.getByText("Add clip"));

		expect(await screen.findByText("Unable to add clip.")).toBeInTheDocument();

		act(() => {
			jest.advanceTimersByTime(1000);
		});
		expect(screen.getByText(/queued/)).toBeInTheDocument();
	});

	it("ignores websocket ack, malformed payloads, and non-overlay messages", async () => {
		render(<ControllerClient overlayId='ov-1' controllerToken='signed-token' />);
		const ws = MockWebSocket.instances[0];
		await emitSocketOpen(ws);

		await act(async () => {
			ws.emit("message", { data: "subscribed ov-1" });
			ws.emit("message", { data: "{not-json" });
			ws.emit("message", { data: JSON.stringify({ type: "something_else", data: { kind: "now_playing", clipId: "wrong" } }) });
		});

		expect(screen.getAllByText("No active clip").length).toBeGreaterThan(0);
		expect(screen.queryByText("wrong")).not.toBeInTheDocument();
	});

	it("reconnects after socket close and closes the socket on error", async () => {
		render(<ControllerClient overlayId='ov-1' controllerToken='signed-token' />);
		const firstWs = MockWebSocket.instances[0];
		await emitSocketOpen(firstWs);
		await emitSocketClose(firstWs);

		act(() => {
			jest.advanceTimersByTime(1500);
		});

		expect(MockWebSocket.instances).toHaveLength(2);
		const secondWs = MockWebSocket.instances[1];
		await emitSocketError(secondWs);
		expect(secondWs.close).toHaveBeenCalled();
	});

	it("waits for window load before connecting when the document is still loading", async () => {
		Object.defineProperty(document, "readyState", { configurable: true, value: "loading" });
		render(<ControllerClient overlayId='ov-1' controllerToken='signed-token' />);

		expect(MockWebSocket.instances).toHaveLength(0);

		await act(async () => {
			window.dispatchEvent(new Event("load"));
		});

		expect(MockWebSocket.instances).toHaveLength(1);
	});

	it("backs off queue polling while the document is hidden", async () => {
		Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
		render(<ControllerClient overlayId='ov-1' controllerToken='signed-token' />);
		const ws = MockWebSocket.instances[0];
		await emitSocketOpen(ws);

		expect(getControllerQueuesAction).toHaveBeenCalledTimes(0);

		act(() => {
			jest.advanceTimersByTime(30000);
		});

		expect(getControllerQueuesAction).toHaveBeenCalledTimes(0);
	});

	it("maps partial overlay state payloads to safe controller defaults", async () => {
		render(<ControllerClient overlayId='ov-1' controllerToken='signed-token' />);
		const ws = MockWebSocket.instances[0];
		await emitSocketOpen(ws);

		await emitSocketMessage(ws, {
			type: "overlay_state",
			data: {
				kind: "heartbeat",
				playerAttached: false,
			},
		});
		await emitSocketMessage(ws, {
			type: "overlay_state",
			data: {
				kind: "playback_state",
				paused: true,
				showPlayer: false,
				volume: 12,
				muted: true,
			},
		});
		await emitSocketMessage(ws, {
			type: "overlay_state",
			data: {
				kind: "now_playing",
				clipId: "clip-fallback",
			},
		});
		await emitSocketMessage(ws, {
			type: "overlay_state",
			data: {
				kind: "queue_preview",
				items: [
					null,
					{ nope: true },
					{ clipId: "next-good" },
				],
			},
		});

		expect(screen.getAllByText("No player").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Offline").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Hidden").length).toBeGreaterThan(0);
		expect(screen.getAllByText("clip-fallback").length).toBeGreaterThan(0);
		expect(screen.getAllByText("unknown").length).toBeGreaterThan(0);
		expect(screen.getByText("next-good")).toBeInTheDocument();
		expect(screen.getAllByText("0:00").length).toBeGreaterThan(0);
	});

	it("maps healthy overlay state into visible playing UI labels", async () => {
		render(<ControllerClient overlayId='ov-1' controllerToken='signed-token' />);
		const ws = MockWebSocket.instances[0];
		await emitSocketOpen(ws);

		await emitSocketMessage(ws, {
			type: "overlay_state",
			data: {
				kind: "heartbeat",
				playerAttached: true,
			},
		});
		await emitSocketMessage(ws, {
			type: "overlay_state",
			data: {
				kind: "playback_state",
				paused: false,
				showPlayer: true,
				volume: 64,
				muted: false,
			},
		});
		await emitSocketMessage(ws, {
			type: "overlay_state",
			data: {
				kind: "now_playing",
				clipId: "clip-1",
				title: "Healthy Clip",
				creatorName: "alice",
				duration: 42,
				currentTime: 12,
			},
		});

		expect(screen.getAllByText("Playing").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Visible").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Healthy Clip").length).toBeGreaterThan(0);
		expect(screen.getByText("by alice")).toBeInTheDocument();
		expect(screen.getByDisplayValue("64")).toBeInTheDocument();
	});
});
