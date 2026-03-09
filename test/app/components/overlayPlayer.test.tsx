import type { ElementType, ReactNode, VideoHTMLAttributes } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import OverlayPlayer from "@/app/components/overlayPlayer";

const getAvatar = jest.fn();
const getDemoClip = jest.fn();
const getGameDetails = jest.fn();
const getTwitchClip = jest.fn();
const getTwitchClipBatch = jest.fn();
const resolvePlayableClip = jest.fn();
const subscribeToChat = jest.fn();
const subscribeToClipCreate = jest.fn();

const getFirstFromClipQueue = jest.fn();
const getFirstFromModQueue = jest.fn();
const removeFromClipQueue = jest.fn();
const removeFromModQueue = jest.fn();

jest.mock("@actions/twitch", () => ({
	getAvatar: (...args: unknown[]) => getAvatar(...args),
	getDemoClip: (...args: unknown[]) => getDemoClip(...args),
	getGameDetails: (...args: unknown[]) => getGameDetails(...args),
	getTwitchClip: (...args: unknown[]) => getTwitchClip(...args),
	getTwitchClipBatch: (...args: unknown[]) => getTwitchClipBatch(...args),
	resolvePlayableClip: (...args: unknown[]) => resolvePlayableClip(...args),
	subscribeToChat: (...args: unknown[]) => subscribeToChat(...args),
	subscribeToClipCreate: (...args: unknown[]) => subscribeToClipCreate(...args),
}));

jest.mock("@actions/database", () => ({
	getFirstFromClipQueue: (...args: unknown[]) => getFirstFromClipQueue(...args),
	getFirstFromModQueue: (...args: unknown[]) => getFirstFromModQueue(...args),
	removeFromClipQueue: (...args: unknown[]) => removeFromClipQueue(...args),
	removeFromModQueue: (...args: unknown[]) => removeFromModQueue(...args),
}));

jest.mock("@components/playerOverlay", () => ({
	__esModule: true,
	default: ({ children }: { children: ReactNode }) => <div data-testid='player-overlay'>{children}</div>,
}));

jest.mock("@components/logo", () => ({
	__esModule: true,
	default: (props: Record<string, unknown>) => <svg data-testid='logo' {...props} />,
}));

jest.mock("@tabler/icons-react", () => ({
	IconPlayerPlayFilled: (props: Record<string, unknown>) => <svg data-testid='icon-play' {...props} />,
	IconVolume: (props: Record<string, unknown>) => <svg data-testid='icon-volume' {...props} />,
	IconVolumeOff: (props: Record<string, unknown>) => <svg data-testid='icon-volume-off' {...props} />,
}));

jest.mock("@heroui/react", () => ({
	Avatar: ({ src }: { src?: string }) => <img alt='avatar' src={src || undefined} />,
	Button: ({ as, children, ...props }: { as?: ElementType; children: ReactNode }) => {
		const Component = as ?? "button";
		return <Component {...props}>{children}</Component>;
	},
	Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

jest.mock("framer-motion", () => ({
	motion: {
		video: ({ children, ...props }: VideoHTMLAttributes<HTMLVideoElement>) => <video {...props}>{children}</video>,
	},
}));

function buildClip(id: string, overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id,
		url: `https://clips.twitch.tv/${id}`,
		embed_url: `https://clips.twitch.tv/embed?clip=${id}`,
		broadcaster_id: "owner-1",
		broadcaster_name: "owner",
		creator_id: `creator-${id}`,
		creator_name: `Creator-${id}`,
		video_id: "video-1",
		game_id: "game-1",
		language: "en",
		title: `clip-${id}`,
		view_count: 10,
		created_at: "2026-03-08T00:00:00.000Z",
		thumbnail_url: "https://thumb",
		duration: 30,
		...overrides,
	};
}

function buildOverlay(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: "overlay-1",
		ownerId: "owner-1",
		secret: "secret",
		name: "Overlay",
		status: "active",
		type: "All",
		rewardId: null,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		lastUsedAt: null,
		minClipDuration: 0,
		maxClipDuration: 60,
		maxDurationMode: "filter",
		minClipViews: 0,
		blacklistWords: [],
		playbackMode: "random",
		preferCurrentCategory: false,
		clipCreatorsOnly: [],
		clipCreatorsBlocked: [],
		clipPackSize: 50,
		playerVolume: 50,
		showChannelInfo: true,
		showClipInfo: true,
		showTimer: true,
		showProgressBar: true,
		overlayInfoFadeOutSeconds: 6,
		themeFontFamily: "inherit",
		themeTextColor: "#FFFFFF",
		themeAccentColor: "#7C3AED",
		themeBackgroundColor: "rgba(10,10,10,0.65)",
		progressBarStartColor: "#26018E",
		progressBarEndColor: "#8D42F9",
		borderSize: 0,
		borderRadius: 10,
		effectScanlines: false,
		effectStatic: false,
		effectCrt: false,
		channelInfoX: 0,
		channelInfoY: 0,
		clipInfoX: 100,
		clipInfoY: 100,
		timerX: 100,
		timerY: 0,
		channelScale: 100,
		clipScale: 100,
		timerScale: 100,
		...overrides,
	} as never;
}

const playMock = jest.fn().mockResolvedValue(undefined);
const pauseMock = jest.fn();

type SocketListener = (event: { data?: string; type?: string }) => void;

class MockWebSocket {
	static instances: MockWebSocket[] = [];
	readyState = 1;
	url: string;
	private listeners = new Map<string, SocketListener[]>();
	send = jest.fn();
	close = jest.fn();

	constructor(url: string) {
		this.url = url;
		MockWebSocket.instances.push(this);
	}

	addEventListener(type: string, listener: SocketListener) {
		const list = this.listeners.get(type) ?? [];
		list.push(listener);
		this.listeners.set(type, list);
	}

	emit(type: string, event: { data?: string; type?: string }) {
		const list = this.listeners.get(type) ?? [];
		for (const listener of list) {
			listener(event);
		}
	}
}

function getMediaPayload(slug: string) {
	return {
		data: [
			{
				data: {
					clip: {
						videoQualities: [{ quality: "1080", sourceURL: `https://media.example/${slug}.mp4` }],
						playbackAccessToken: { signature: `sig-${slug}`, value: `token-${slug}` },
					},
				},
			},
		],
	};
}

async function sendDemoCommand(name: string, data = "") {
	await act(async () => {
		window.dispatchEvent(
			new MessageEvent("message", {
				origin: window.location.origin,
				data: { name, data },
			}),
		);
	});
}

async function sendSocketPayload(ws: MockWebSocket | undefined, payload: unknown) {
	await act(async () => {
		ws?.emit("message", {
			data: JSON.stringify(payload),
		});
	});
}

function setVideoTiming(video: HTMLVideoElement, duration: number, currentTime: number) {
	Object.defineProperty(video, "duration", {
		configurable: true,
		get: () => duration,
	});
	Object.defineProperty(video, "currentTime", {
		configurable: true,
		writable: true,
		value: currentTime,
	});
}

describe("components/overlayPlayer", () => {
	beforeAll(() => {
		Object.defineProperty(HTMLMediaElement.prototype, "play", {
			configurable: true,
			writable: true,
			value: playMock,
		});
		Object.defineProperty(HTMLMediaElement.prototype, "pause", {
			configurable: true,
			writable: true,
			value: pauseMock,
		});
	});

	beforeEach(() => {
		jest.clearAllMocks();
		MockWebSocket.instances = [];
		(globalThis as { WebSocket: typeof WebSocket }).WebSocket = MockWebSocket as never;

		jest.spyOn(axios, "post").mockImplementation((_url: string, body: unknown) => {
			const slug = ((body as Array<{ variables?: { slug?: string } }>)[0]?.variables?.slug ?? "fallback") as string;
			return Promise.resolve(getMediaPayload(slug) as never);
		});

		getAvatar.mockResolvedValue("https://avatar.example/owner.png");
		getGameDetails.mockResolvedValue({ id: "game-1", name: "Game", box_art_url: "", igdb_id: "" });
		getDemoClip.mockResolvedValue(null);
		getTwitchClip.mockResolvedValue(null);
		getTwitchClipBatch.mockResolvedValue([]);
		resolvePlayableClip.mockImplementation(async (_ownerId: string, clip: unknown) => clip);
		subscribeToChat.mockResolvedValue(undefined);
		subscribeToClipCreate.mockResolvedValue(undefined);
		getFirstFromModQueue.mockResolvedValue(null);
		getFirstFromClipQueue.mockResolvedValue(null);
		removeFromModQueue.mockResolvedValue(undefined);
		removeFromClipQueue.mockResolvedValue(undefined);
		for (const element of Array.from(document.head.querySelectorAll("link[id^='overlay-font-']"))) {
			element.remove();
		}
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("prefers mod queue clips over normal queue during clip selection", async () => {
		const queuedClip = buildClip("mod-priority", { title: "mod-priority-clip" });
		getFirstFromModQueue.mockResolvedValue({ id: "mod-q1", clipId: queuedClip.id });
		getTwitchClip.mockResolvedValue(queuedClip);

		render(<OverlayPlayer overlay={buildOverlay()} />);

		await screen.findByText("mod-priority-clip");
		expect(getFirstFromModQueue).toHaveBeenCalledWith("overlay-1", undefined);
		expect(getFirstFromClipQueue).not.toHaveBeenCalled();
		expect(removeFromModQueue).toHaveBeenCalledWith("mod-q1", "overlay-1", undefined);
		expect(removeFromClipQueue).toHaveBeenCalledWith("mod-q1", "overlay-1", undefined);
	});

	it("loads from cached clip pool and resolves playback candidate when queues are empty", async () => {
		const topClip = buildClip("top-1", { title: "top-clip", view_count: 500 });
		const lowClip = buildClip("low-1", { title: "low-clip", view_count: 10 });
		getTwitchClipBatch.mockResolvedValue([topClip, lowClip]);

		render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "top" })} />);

		await screen.findByText("top-clip");
		expect(getTwitchClipBatch).toHaveBeenCalledWith("overlay-1", undefined, "All", expect.any(Array), 50);
		expect(resolvePlayableClip).toHaveBeenCalledWith("owner-1", expect.objectContaining({ id: "top-1" }));
	});

	it("handles embed click-to-play and mute toggle controls", async () => {
		getTwitchClipBatch.mockResolvedValue([buildClip("embed-1", { title: "embed-clip" })]);

		render(<OverlayPlayer overlay={buildOverlay()} isEmbed embedAutoplay={false} embedMuted />);

		await waitFor(() => {
			expect(document.querySelectorAll("video").length).toBeGreaterThan(0);
		});

		const playCta = screen.getByRole("button", { name: "Play clips" });
		const muteButton = screen.getByRole("button", { name: "Unmute overlay" });

		fireEvent.click(muteButton);
		expect(screen.getByRole("button", { name: "Mute overlay" })).toBeInTheDocument();

		fireEvent.click(playCta);
		await waitFor(() => {
			expect(screen.queryByRole("button", { name: "Play clips" })).not.toBeInTheDocument();
		});
		expect(subscribeToChat).not.toHaveBeenCalled();
		expect(subscribeToClipCreate).not.toHaveBeenCalled();
	});

	it("renders embed overlay badge path and progress fallback colors", async () => {
		getTwitchClipBatch.mockResolvedValue([buildClip("embed-style", { title: "embed-style-clip" })]);

		render(
			<OverlayPlayer
				overlay={buildOverlay({
					channelInfoX: 90,
					channelInfoY: 90,
					progressBarStartColor: "",
					progressBarEndColor: "",
				})}
				isEmbed
				showBanner
				showEmbedOverlay
				embedAutoplay
			/>,
		);

		await screen.findByText("embed-style-clip");
		expect(screen.getByRole("link", { name: "Powered by Clipify" })).toBeInTheDocument();

		const gradientBar = document.querySelector("div[style*='linear-gradient(90deg']");
		expect(gradientBar?.getAttribute("style")).toContain("#26018E");
		expect(gradientBar?.getAttribute("style")).toContain("#8D42F9");
	});

	it("accepts valid demo play command URLs and clamps runtime volume commands", async () => {
		getTwitchClipBatch.mockResolvedValue([buildClip("demo-pool", { title: "demo-pool-clip" })]);
		getDemoClip.mockResolvedValue(buildClip("DemoClip1"));

		render(<OverlayPlayer overlay={buildOverlay()} isDemoPlayer />);

		await screen.findByText("demo-pool-clip");

		await sendDemoCommand("play", "https://example.com/not-twitch");
		expect(getDemoClip).not.toHaveBeenCalled();

		await sendDemoCommand("play", "https://clips.twitch.tv/DemoClip1");
		await waitFor(() => {
			expect(getDemoClip).toHaveBeenCalledWith("DemoClip1");
		});

		const activeVideo = document.querySelector("video") as HTMLVideoElement;
		expect(activeVideo).toBeTruthy();

		await sendDemoCommand("volume", "150");
		await waitFor(() => {
			expect(activeVideo.volume).toBe(1);
		});

		await sendDemoCommand("volume", "-20");
		await waitFor(() => {
			expect(activeVideo.volume).toBe(0);
		});

		await sendDemoCommand("pause");
		expect(pauseMock).toHaveBeenCalled();

		await sendDemoCommand("play");
		expect(playMock).toHaveBeenCalled();
	});

	it("starts demo playback on first play command when no clip is currently active", async () => {
		getTwitchClipBatch.mockResolvedValue([]);
		getDemoClip.mockResolvedValue(buildClip("demo-first", { title: "demo-first-clip" }));

		render(<OverlayPlayer overlay={buildOverlay()} isDemoPlayer />);
		expect(screen.queryByText("demo-first-clip")).not.toBeInTheDocument();

		await sendDemoCommand("play", "https://clips.twitch.tv/demo-first");
		await screen.findByText("demo-first-clip");
		expect(getDemoClip).toHaveBeenCalledWith("demo-first");
	});

	it("wires websocket subscription and handles command messages", async () => {
		getTwitchClipBatch.mockResolvedValue([buildClip("ws-clip")]);

		render(<OverlayPlayer overlay={buildOverlay()} />);
		await screen.findByText("clip-ws-clip");

		const ws = MockWebSocket.instances[0];
		expect(ws).toBeDefined();

		await act(async () => {
			ws?.emit("open", { type: "open" });
		});
		expect(ws?.send).toHaveBeenCalledWith(
			JSON.stringify({
				type: "subscribe",
				data: { overlayId: "overlay-1", secret: undefined },
			}),
		);

		await act(async () => {
			ws?.emit("message", {
				data: JSON.stringify({
					type: "command",
					data: { name: "pause", data: "" },
				}),
			});
		});

		expect(pauseMock).toHaveBeenCalled();
		expect(subscribeToChat).toHaveBeenCalledWith("owner-1");
		expect(subscribeToClipCreate).toHaveBeenCalledWith("owner-1");
	});

	it("falls back to the next top clip when the highest-view clip is not playable", async () => {
		const high = buildClip("top-high", { title: "top-high", view_count: 999 });
		const mid = buildClip("top-mid", { title: "top-mid", view_count: 555 });
		getTwitchClipBatch.mockResolvedValue([high, mid]);
		resolvePlayableClip.mockImplementation(async (_ownerId: string, clip: { id?: string }) => {
			if (clip.id === "top-high") return null;
			return clip;
		});

		render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "top" })} />);

		await screen.findByText("top-mid");
		expect(resolvePlayableClip).toHaveBeenCalledWith("owner-1", expect.objectContaining({ id: "top-high" }));
		expect(resolvePlayableClip).toHaveBeenCalledWith("owner-1", expect.objectContaining({ id: "top-mid" }));
	});

	it("returns no clip when smart-shuffle cannot resolve any playable candidates", async () => {
		const clips = Array.from({ length: 4 }, (_, index) =>
			buildClip(`smart-null-${index + 1}`, {
				title: `smart-null-title-${index + 1}`,
				view_count: 800 - index * 50,
			}),
		);
		getTwitchClipBatch.mockResolvedValue(clips);
		resolvePlayableClip.mockResolvedValue(null);

		render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "smart_shuffle" })} />);

		await waitFor(() => {
			expect(resolvePlayableClip.mock.calls.length).toBeGreaterThanOrEqual(clips.length);
		});
		const attemptedIds = new Set(resolvePlayableClip.mock.calls.map((call) => (call[1] as { id?: string })?.id));
		for (const clip of clips) {
			expect(attemptedIds.has(clip.id)).toBe(true);
		}
		expect(screen.queryByText("smart-null-title-1")).not.toBeInTheDocument();
	});

	it("returns no clip when random mode cannot resolve any playable candidates", async () => {
		const clips = [
			buildClip("random-null-1", { title: "random-null-title-1", view_count: 100 }),
			buildClip("random-null-2", { title: "random-null-title-2", view_count: 90 }),
			buildClip("random-null-3", { title: "random-null-title-3", view_count: 80 }),
		];
		getTwitchClipBatch.mockResolvedValue(clips);
		resolvePlayableClip.mockResolvedValue(null);

		render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "random" })} />);

		await waitFor(() => {
			expect(resolvePlayableClip.mock.calls.length).toBeGreaterThanOrEqual(clips.length);
		});
		const attemptedIds = new Set(resolvePlayableClip.mock.calls.map((call) => (call[1] as { id?: string })?.id));
		for (const clip of clips) {
			expect(attemptedIds.has(clip.id)).toBe(true);
		}
		expect(screen.queryByText("random-null-title-1")).not.toBeInTheDocument();
	});

	it("retries smart-shuffle candidates until a playable clip is found", async () => {
		const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0);
		const clips = Array.from({ length: 13 }, (_, index) =>
			buildClip(`smart-${index + 1}`, {
				title: `smart-title-${index + 1}`,
				view_count: 1000 - index * 20,
				created_at: `2026-03-${String(9 - Math.min(index, 8)).padStart(2, "0")}T00:00:00.000Z`,
			}),
		);
		getTwitchClipBatch.mockResolvedValue(clips);
		resolvePlayableClip.mockImplementation(async (_ownerId: string, clip: { id?: string }) => {
			if (clip.id === "smart-1") return null;
			return clip;
		});

		try {
			render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "smart_shuffle" })} />);
			await screen.findByText("smart-title-2");
			expect(resolvePlayableClip.mock.calls.length).toBeGreaterThanOrEqual(2);
			expect(resolvePlayableClip).toHaveBeenNthCalledWith(1, "owner-1", expect.objectContaining({ id: "smart-1" }));
			expect(resolvePlayableClip).toHaveBeenNthCalledWith(2, "owner-1", expect.objectContaining({ id: "smart-2" }));
		} finally {
			randomSpy.mockRestore();
		}
	});

	it("recomputes smart-shuffle selection after a played clip is recorded via crossfade", async () => {
		jest.useFakeTimers();
		const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0);
		const clips = Array.from({ length: 13 }, (_, index) =>
			buildClip(`smart-played-${index + 1}`, {
				title: `smart-played-${index + 1}`,
				creator_id: index === 0 ? "" : `creator-${index + 1}`,
				creator_name: index === 0 ? "creator-fallback" : `Creator-${index + 1}`,
				game_id: index % 2 === 0 ? "game-a" : "game-b",
				view_count: 1000 - index * 20,
			}),
		);
		getTwitchClipBatch.mockResolvedValue(clips);

		try {
			render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "smart_shuffle" })} />);
			await screen.findByText("smart-played-1");
			await waitFor(() => {
				expect(document.querySelectorAll("video").length).toBeGreaterThanOrEqual(2);
			});

			const videos = Array.from(document.querySelectorAll("video")) as HTMLVideoElement[];
			const slotA = videos.find((video) => video.src.includes("smart-played-1")) as HTMLVideoElement | undefined;
			const slotB = videos.find((video) => video !== slotA) as HTMLVideoElement | undefined;
			expect(slotA).toBeTruthy();
			expect(slotB).toBeTruthy();

			fireEvent.canPlay(slotB!);
			setVideoTiming(slotA!, 10, 9.5);
			fireEvent.timeUpdate(slotA!);

			await act(async () => {
				jest.advanceTimersByTime(750);
			});

			await waitFor(() => {
				expect(screen.queryByText("smart-played-1")).not.toBeInTheDocument();
			});
			await waitFor(() => {
				expect(resolvePlayableClip.mock.calls.length).toBeGreaterThan(1);
			});
		} finally {
			randomSpy.mockRestore();
		}
	});

	it("parses raw demo clip IDs and ignores malformed inputs", async () => {
		getTwitchClipBatch.mockResolvedValue([]);
		getDemoClip.mockImplementation(async (id: string) => {
			if (id === "RawDemo_1") return buildClip("RawDemo_1", { title: "raw-demo-clip" });
			return null;
		});

		render(<OverlayPlayer overlay={buildOverlay()} isDemoPlayer />);
		await sendDemoCommand("play", "bad id***");
		expect(getDemoClip).not.toHaveBeenCalled();

		await sendDemoCommand("play", "RawDemo_1");
		await screen.findByText("raw-demo-clip");
		expect(getDemoClip).toHaveBeenCalledWith("RawDemo_1");
	});

	it("parses /clip routes and clips subdomains for demo play commands", async () => {
		getTwitchClipBatch.mockResolvedValue([]);
		getDemoClip.mockResolvedValue(buildClip("demo-url-clip", { title: "demo-url-clip" }));

		render(<OverlayPlayer overlay={buildOverlay()} isDemoPlayer />);
		await sendDemoCommand("play", "https://www.twitch.tv/somechannel/clip/PathSlug_1");
		await sendDemoCommand("play", "https://foo.clips.twitch.tv/SubdomainSlug_2");
		await sendDemoCommand("play", "https://www.twitch.tv/somechannel/videos/12345");

		await waitFor(() => {
			expect(getDemoClip).toHaveBeenCalledWith("PathSlug_1");
			expect(getDemoClip).toHaveBeenCalledWith("SubdomainSlug_2");
		});
		expect(getDemoClip).not.toHaveBeenCalledWith("videos");
	});

	it("ignores demo play URLs when clip lookup returns null", async () => {
		getTwitchClipBatch.mockResolvedValue([buildClip("seed", { title: "seed-clip" })]);
		getDemoClip.mockResolvedValue(null);

		render(<OverlayPlayer overlay={buildOverlay()} isDemoPlayer />);
		await screen.findByText("seed-clip");

		await sendDemoCommand("play", "https://clips.twitch.tv/DoesNotExist");
		await waitFor(() => {
			expect(getDemoClip).toHaveBeenCalledWith("DoesNotExist");
		});
		expect(screen.queryByText("clip-DoesNotExist")).not.toBeInTheDocument();
	});

	it("handles websocket redemption and malformed websocket payloads safely", async () => {
		let releaseBatch: (() => void) | null = null;
		const deferredBatch = new Promise<ReturnType<typeof buildClip>[]>((resolve) => {
			releaseBatch = () => resolve([buildClip("redeem-late", { title: "redeem-late-clip" })]);
		});
		getTwitchClipBatch.mockImplementation(() => deferredBatch);
		const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

		try {
			render(<OverlayPlayer overlay={buildOverlay()} />);
			const ws = MockWebSocket.instances[0];
			expect(ws).toBeDefined();

			await sendSocketPayload(ws, { type: "new_clip_redemption" });

			await act(async () => {
				releaseBatch?.();
			});
			await screen.findByText("redeem-late-clip");

			await act(async () => {
				ws?.emit("message", { data: "{bad-json" });
			});

			expect(consoleSpy).toHaveBeenCalledWith("Error handling WebSocket message:", expect.any(Error));
		} finally {
			consoleSpy.mockRestore();
		}
	});

	it("logs websocket errors and closes the socket", async () => {
		getTwitchClipBatch.mockResolvedValue([buildClip("ws-error", { title: "ws-error-clip" })]);
		const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

		try {
			render(<OverlayPlayer overlay={buildOverlay()} />);
			await screen.findByText("ws-error-clip");

			const ws = MockWebSocket.instances[0];
			await act(async () => {
				ws?.emit("error", { type: "error" });
			});

			expect(ws?.close).toHaveBeenCalled();
			expect(consoleSpy).toHaveBeenCalledWith("WebSocket error", expect.objectContaining({ type: "error" }));
		} finally {
			consoleSpy.mockRestore();
		}
	});

	it("handles chat subscription errors without crashing overlay playback", async () => {
		getTwitchClipBatch.mockResolvedValue([buildClip("chat-failure", { title: "chat-failure-clip" })]);
		subscribeToChat.mockRejectedValue(new Error("eventsub down"));
		const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

		try {
			render(<OverlayPlayer overlay={buildOverlay()} />);
			await screen.findByText("chat-failure-clip");
			await waitFor(() => {
				expect(consoleSpy).toHaveBeenCalledWith("Error subscribing to EventSub", expect.any(Error));
			});
		} finally {
			consoleSpy.mockRestore();
		}
	});

	it("handles websocket hide/show and volume command edge cases", async () => {
		getTwitchClipBatch.mockResolvedValue([buildClip("ws-commands", { title: "ws-commands-clip" })]);
		playMock.mockRejectedValueOnce(new Error("autoplay blocked"));
		const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

		try {
			render(<OverlayPlayer overlay={buildOverlay()} />);
			await screen.findByText("ws-commands-clip");
			const ws = MockWebSocket.instances[0];
			const activeVideo = document.querySelector("video") as HTMLVideoElement;
			expect(activeVideo).toBeTruthy();

			await sendSocketPayload(ws, { type: "command", data: { name: "hide", data: "" } });
			expect(pauseMock).toHaveBeenCalled();

			await sendSocketPayload(ws, { type: "command", data: { name: "show", data: "" } });
			expect(consoleSpy).toHaveBeenCalledWith("Error playing the video:", expect.any(Error));

			await sendSocketPayload(ws, { type: "command", data: { name: "volume", data: "175" } });
			await waitFor(() => {
				expect(activeVideo.volume).toBe(1);
			});

			await sendSocketPayload(ws, { type: "command", data: { name: "volume", data: "abc" } });
			await waitFor(() => {
				expect(activeVideo.volume).toBe(1);
			});
		} finally {
			consoleSpy.mockRestore();
		}
	});

	it("falls back to click-to-play when embed autoplay is blocked", async () => {
		getTwitchClipBatch.mockResolvedValue([buildClip("embed-autoplay", { title: "embed-autoplay-clip" })]);
		playMock.mockRejectedValueOnce(new Error("blocked"));
		const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

		try {
			render(<OverlayPlayer overlay={buildOverlay()} isEmbed embedAutoplay />);
			await screen.findByRole("button", { name: "Play clips" });
			expect(consoleSpy).toHaveBeenCalledWith("Error playing the video:", expect.any(Error));
		} finally {
			consoleSpy.mockRestore();
		}
	});

	it("adds theme font stylesheet once across remounts", async () => {
		getTwitchClipBatch.mockResolvedValue([buildClip("font-clip", { title: "font-clip-title" })]);
		const themedOverlay = buildOverlay({
			themeFontFamily: "Inter||url||https://fonts.googleapis.com/css2?family=Inter:wght@500",
		});

		const first = render(<OverlayPlayer overlay={themedOverlay} />);
		await screen.findByText("font-clip-title");
		first.unmount();

		render(<OverlayPlayer overlay={themedOverlay} />);
		await screen.findByText("font-clip-title");

		const fontLinks = document.head.querySelectorAll("link[href='https://fonts.googleapis.com/css2?family=Inter:wght@500']");
		expect(fontLinks).toHaveLength(1);
	});

	it("keeps current clip when skip cannot fetch new clips and cache refresh fails", async () => {
		const queueClip = buildClip("queue-only", { title: "queue-only-clip" });
		getFirstFromModQueue.mockResolvedValueOnce({ id: "queued-1", clipId: queueClip.id });
		getTwitchClip.mockResolvedValue(queueClip);
		getTwitchClipBatch.mockRejectedValue(new Error("cache unavailable"));
		const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

		try {
			render(<OverlayPlayer overlay={buildOverlay()} />);
			await screen.findByText("queue-only-clip");
			const ws = MockWebSocket.instances[0];

			await sendSocketPayload(ws, { type: "command", data: { name: "skip", data: "" } });
			await screen.findByText("queue-only-clip");
			expect(consoleSpy).toHaveBeenCalledWith("Error refreshing clip pool:", expect.any(Error));
		} finally {
			consoleSpy.mockRestore();
		}
	});

	it("crossfades to prefetched clip when incoming slot is ready near clip end", async () => {
		jest.useFakeTimers();
		const firstClip = buildClip("crossfade-a", { title: "crossfade-a", view_count: 900 });
		const secondClip = buildClip("crossfade-b", { title: "crossfade-b", view_count: 100 });
		getTwitchClipBatch.mockResolvedValue([firstClip, secondClip]);

		render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "top" })} />);
		await screen.findByText("crossfade-a");

		await waitFor(() => {
			expect(document.querySelectorAll("video").length).toBeGreaterThanOrEqual(2);
		});

		const videos = Array.from(document.querySelectorAll("video")) as HTMLVideoElement[];
		const slotA = videos[0]!;
		const slotB = videos[1]!;
		fireEvent.canPlay(slotB);
		setVideoTiming(slotA, 10, 9.5);
		fireEvent.timeUpdate(slotA);

		await act(async () => {
			jest.advanceTimersByTime(750);
		});

		await screen.findByText("crossfade-b");
	});

	it("holds the last frame when next clip is not ready and then advances after timeout", async () => {
		jest.useFakeTimers();
		const firstClip = buildClip("hold-a", { title: "hold-a", view_count: 900 });
		const secondClip = buildClip("hold-b", { title: "hold-b", view_count: 100 });
		getTwitchClipBatch.mockResolvedValue([firstClip, secondClip]);

		render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "top" })} />);
		await screen.findByText("hold-a");

		await waitFor(() => {
			expect(document.querySelectorAll("video").length).toBeGreaterThanOrEqual(2);
		});

		const videos = Array.from(document.querySelectorAll("video")) as HTMLVideoElement[];
		const slotA = videos[0]!;
		setVideoTiming(slotA, 10, 9.5);
		fireEvent.timeUpdate(slotA);
		expect(pauseMock).toHaveBeenCalled();

		await act(async () => {
			jest.advanceTimersByTime(1600);
		});

		await screen.findByText("hold-b");
	});

	it("keeps hold state across hide/show toggles until timeout advances clip", async () => {
		jest.useFakeTimers();
		const firstClip = buildClip("hold-toggle-a", { title: "hold-toggle-a", view_count: 900 });
		const secondClip = buildClip("hold-toggle-b", { title: "hold-toggle-b", view_count: 100 });
		getTwitchClipBatch.mockResolvedValue([firstClip, secondClip]);

		render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "top" })} />);
		await screen.findByText("hold-toggle-a");
		await waitFor(() => {
			expect(document.querySelectorAll("video").length).toBeGreaterThanOrEqual(2);
		});

		const slotA = Array.from(document.querySelectorAll("video")).find((video) => (video as HTMLVideoElement).src.includes("hold-toggle-a")) as
			| HTMLVideoElement
			| undefined;
		expect(slotA).toBeTruthy();
		setVideoTiming(slotA!, 10, 9.5);
		fireEvent.timeUpdate(slotA!);
		expect(pauseMock).toHaveBeenCalled();

		const ws = MockWebSocket.instances[0];
		await sendSocketPayload(ws, { type: "command", data: { name: "hide", data: "" } });
		await sendSocketPayload(ws, { type: "command", data: { name: "show", data: "" } });

		await act(async () => {
			jest.advanceTimersByTime(700);
		});
		expect(screen.getByText("hold-toggle-a")).toBeInTheDocument();

		await act(async () => {
			jest.advanceTimersByTime(900);
		});
		await screen.findByText("hold-toggle-b");
	});

	it("clears hold timeout when skip advances while hold state is active", async () => {
		jest.useFakeTimers();
		const firstClip = buildClip("hold-skip-a", { title: "hold-skip-a", view_count: 900 });
		const secondClip = buildClip("hold-skip-b", { title: "hold-skip-b", view_count: 100 });
		getTwitchClipBatch.mockResolvedValue([firstClip, secondClip]);
		const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

		try {
			render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "top" })} />);
			await screen.findByText("hold-skip-a");
			await waitFor(() => {
				expect(document.querySelectorAll("video").length).toBeGreaterThanOrEqual(2);
			});

			const slotA = Array.from(document.querySelectorAll("video")).find((video) => (video as HTMLVideoElement).src.includes("hold-skip-a")) as
				| HTMLVideoElement
				| undefined;
			expect(slotA).toBeTruthy();

			setVideoTiming(slotA!, 10, 9.5);
			fireEvent.timeUpdate(slotA!);

			const ws = MockWebSocket.instances[0];
			await sendSocketPayload(ws, { type: "command", data: { name: "skip", data: "" } });
			await screen.findByText("hold-skip-b");

			expect(clearTimeoutSpy).toHaveBeenCalled();

			await act(async () => {
				jest.advanceTimersByTime(2_000);
			});
			expect(screen.getByText("hold-skip-b")).toBeInTheDocument();
		} finally {
			clearTimeoutSpy.mockRestore();
		}
	});

	it("clears hold timeout when active slot A errors while hold state is active", async () => {
		jest.useFakeTimers();
		const firstClip = buildClip("hold-slota-a", { title: "hold-slota-a", view_count: 900 });
		const secondClip = buildClip("hold-slota-b", { title: "hold-slota-b", view_count: 100 });
		getTwitchClipBatch.mockResolvedValue([firstClip, secondClip]);
		const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

		try {
			render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "top" })} />);
			await screen.findByText("hold-slota-a");
			await waitFor(() => {
				expect(document.querySelectorAll("video").length).toBeGreaterThanOrEqual(2);
			});

			const slotA = Array.from(document.querySelectorAll("video")).find((video) => (video as HTMLVideoElement).src.includes("hold-slota-a")) as
				| HTMLVideoElement
				| undefined;
			expect(slotA).toBeTruthy();

			setVideoTiming(slotA!, 10, 9.5);
			fireEvent.timeUpdate(slotA!);
			fireEvent.error(slotA!);

			await screen.findByText("hold-slota-b");
			expect(clearTimeoutSpy).toHaveBeenCalled();
		} finally {
			clearTimeoutSpy.mockRestore();
		}
	});

	it("clears hold timeout when active slot B errors while hold state is active", async () => {
		jest.useFakeTimers();
		const firstClip = buildClip("hold-slotb-a", { title: "hold-slotb-a", view_count: 900 });
		const secondClip = buildClip("hold-slotb-b", { title: "hold-slotb-b", view_count: 600 });
		const thirdClip = buildClip("hold-slotb-c", { title: "hold-slotb-c", view_count: 300 });
		getTwitchClipBatch.mockResolvedValue([firstClip, secondClip, thirdClip]);
		const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

		try {
			render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "top" })} />);
			await screen.findByText("hold-slotb-a");
			await waitFor(() => {
				expect(document.querySelectorAll("video").length).toBeGreaterThanOrEqual(2);
			});

			const initialSlotA = Array.from(document.querySelectorAll("video")).find((video) => (video as HTMLVideoElement).src.includes("hold-slotb-a")) as
				| HTMLVideoElement
				| undefined;
			const initialSlotB = Array.from(document.querySelectorAll("video")).find((video) => (video as HTMLVideoElement).src.includes("hold-slotb-b")) as
				| HTMLVideoElement
				| undefined;
			expect(initialSlotA).toBeTruthy();
			expect(initialSlotB).toBeTruthy();

			fireEvent.canPlay(initialSlotB!);
			setVideoTiming(initialSlotA!, 10, 9.5);
			fireEvent.timeUpdate(initialSlotA!);

			await act(async () => {
				jest.advanceTimersByTime(750);
			});
			await screen.findByText("hold-slotb-b");
			await waitFor(() => {
				const hasPrefetchedSlotA = Array.from(document.querySelectorAll("video")).some((video) =>
					(video as HTMLVideoElement).src.includes("hold-slotb-c"),
				);
				expect(hasPrefetchedSlotA).toBe(true);
			});

			const activeSlotB = Array.from(document.querySelectorAll("video")).find((video) => (video as HTMLVideoElement).src.includes("hold-slotb-b")) as
				| HTMLVideoElement
				| undefined;
			expect(activeSlotB).toBeTruthy();

			setVideoTiming(activeSlotB!, 10, 9.5);
			fireEvent.timeUpdate(activeSlotB!);
			fireEvent.error(activeSlotB!);

			await screen.findByText("hold-slotb-c");
			expect(clearTimeoutSpy).toHaveBeenCalled();
		} finally {
			clearTimeoutSpy.mockRestore();
		}
	});

	it("starts embed playback via keyboard on the click-to-play surface", async () => {
		getTwitchClipBatch.mockResolvedValue([buildClip("kbd-start", { title: "kbd-start-clip" })]);

		render(<OverlayPlayer overlay={buildOverlay()} isEmbed embedAutoplay={false} />);
		const playSurface = await screen.findByRole("button", { name: "Play clips" });

		fireEvent.keyDown(playSurface, { key: "Enter" });
		await waitFor(() => {
			expect(screen.queryByRole("button", { name: "Play clips" })).not.toBeInTheDocument();
		});
	});

	it("starts embed playback via Space key on the click-to-play surface", async () => {
		getTwitchClipBatch.mockResolvedValue([buildClip("kbd-space", { title: "kbd-space-clip" })]);

		render(<OverlayPlayer overlay={buildOverlay()} isEmbed embedAutoplay={false} />);
		const playSurface = await screen.findByRole("button", { name: "Play clips" });

		fireEvent.keyDown(playSurface, { key: " " });
		await waitFor(() => {
			expect(screen.queryByRole("button", { name: "Play clips" })).not.toBeInTheDocument();
		});
	});

	it("advances to the next clip when active slot video errors", async () => {
		const firstClip = buildClip("error-a", { title: "error-a", view_count: 900 });
		const secondClip = buildClip("error-b", { title: "error-b", view_count: 100 });
		getTwitchClipBatch.mockResolvedValue([firstClip, secondClip]);

		render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "top" })} />);
		await screen.findByText("error-a");
		await waitFor(() => {
			expect(document.querySelectorAll("video").length).toBeGreaterThanOrEqual(2);
		});

		const videos = Array.from(document.querySelectorAll("video")) as HTMLVideoElement[];
		fireEvent.error(videos[0]!);

		await screen.findByText("error-b");
	});

	it("advances to the next clip when active slot video ends", async () => {
		const firstClip = buildClip("ended-a", { title: "ended-a", view_count: 900 });
		const secondClip = buildClip("ended-b", { title: "ended-b", view_count: 100 });
		getTwitchClipBatch.mockResolvedValue([firstClip, secondClip]);

		render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "top" })} />);
		await screen.findByText("ended-a");
		await waitFor(() => {
			expect(document.querySelectorAll("video").length).toBeGreaterThanOrEqual(2);
		});

		const videos = Array.from(document.querySelectorAll("video")) as HTMLVideoElement[];
		fireEvent.ended(videos[0]!);

		await screen.findByText("ended-b");
	});

	it("backs off polling interval when document is hidden", async () => {
		jest.useFakeTimers();
		getTwitchClipBatch.mockResolvedValue([]);
		const originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
		const timeoutSpy = jest.spyOn(global, "setTimeout");

		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => "hidden",
		});

		try {
			render(<OverlayPlayer overlay={buildOverlay()} />);
			await act(async () => {
				jest.advanceTimersByTime(1);
			});

			const hasBackoffTimer = timeoutSpy.mock.calls.some((call) => Number(call[1]) === 60_000);
			expect(hasBackoffTimer).toBe(true);
		} finally {
			timeoutSpy.mockRestore();
			if (originalVisibilityDescriptor) {
				Object.defineProperty(document, "visibilityState", originalVisibilityDescriptor);
			}
		}
	});

	it("queues a pending skip while advance is locked and drains it in finally", async () => {
		const startClip = buildClip("queue-start", { title: "queue-start-clip", view_count: 999 });
		const skipFirst = buildClip("skip-first", { title: "skip-first-clip", view_count: 300 });
		let modQueueCall = 0;
		let releaseSkipLock: (() => void) | null = null;

		getFirstFromModQueue.mockImplementation(async () => {
			modQueueCall += 1;
			if (modQueueCall === 1) return { id: "mod-start", clipId: startClip.id };
			if (modQueueCall === 2) return null;
			if (modQueueCall === 3) {
				await new Promise<void>((resolve) => {
					releaseSkipLock = resolve;
				});
				return null;
			}
			if (modQueueCall === 4) {
				throw new Error("recursive-advance-failed");
			}
			return null;
		});
		getTwitchClip.mockResolvedValue(startClip);
		getTwitchClipBatch.mockResolvedValueOnce([]).mockResolvedValueOnce([skipFirst]);
		const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

		try {
			render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "top" })} />);
			await screen.findByText("queue-start-clip");
			const ws = MockWebSocket.instances[0];

			await act(async () => {
				ws?.emit("message", {
					data: JSON.stringify({ type: "command", data: { name: "skip", data: "" } }),
				});
				ws?.emit("message", {
					data: JSON.stringify({ type: "command", data: { name: "skip", data: "" } }),
				});
			});

			await act(async () => {
				releaseSkipLock?.();
			});

			await screen.findByText("skip-first-clip");
			await waitFor(() => {
				expect(consoleSpy).toHaveBeenCalledWith("Error advancing clip after pending skip:", expect.any(Error));
			});
		} finally {
			consoleSpy.mockRestore();
		}
	});

	it("logs queue-removal failures when advancing with a prefetched queue clip", async () => {
		const firstClip = buildClip("prefetch-catch-a", { title: "prefetch-catch-a", view_count: 900 });
		const secondClip = buildClip("prefetch-catch-b", { title: "prefetch-catch-b", view_count: 700 });
		let queueCall = 0;
		getFirstFromModQueue.mockImplementation(async () => {
			queueCall += 1;
			if (queueCall === 1) return { id: "prefetch-q-1", clipId: firstClip.id };
			if (queueCall === 2) return { id: "prefetch-q-2", clipId: secondClip.id };
			return null;
		});
		getTwitchClip.mockImplementation(async (clipId: string) => {
			if (clipId === firstClip.id) return firstClip;
			if (clipId === secondClip.id) return secondClip;
			return null;
		});
		getTwitchClipBatch.mockResolvedValue([]);
		removeFromModQueue.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("prefetched mod remove failed"));
		removeFromClipQueue.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("prefetched clip remove failed"));
		const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

		try {
			render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "top" })} />);
			await screen.findByText("prefetch-catch-a");
			await waitFor(() => {
				const hasPrefetchedSlot = Array.from(document.querySelectorAll("video")).some((video) =>
					(video as HTMLVideoElement).src.includes("prefetch-catch-b"),
				);
				expect(hasPrefetchedSlot).toBe(true);
			});

			const ws = MockWebSocket.instances[0];
			await sendSocketPayload(ws, { type: "command", data: { name: "skip", data: "" } });
			await screen.findByText("prefetch-catch-b");

			await waitFor(() => {
				expect(consoleSpy).toHaveBeenCalledWith("Failed to remove from mod queue:", expect.any(Error));
				expect(consoleSpy).toHaveBeenCalledWith("Failed to remove from clip queue:", expect.any(Error));
			});
		} finally {
			consoleSpy.mockRestore();
		}
	});

	it("logs queue-removal failures when advancing with a freshly selected queue clip", async () => {
		const startClip = buildClip("queue-catch-start", { title: "queue-catch-start", view_count: 900 });
		const skipClip = buildClip("queue-catch-next", { title: "queue-catch-next", view_count: 700 });
		let queueCall = 0;
		getFirstFromModQueue.mockImplementation(async () => {
			queueCall += 1;
			if (queueCall === 1) return { id: "queue-catch-start-item", clipId: startClip.id };
			if (queueCall === 3) return { id: "queue-catch-next-item", clipId: skipClip.id };
			return null;
		});
		getTwitchClip.mockImplementation(async (clipId: string) => {
			if (clipId === startClip.id) return startClip;
			if (clipId === skipClip.id) return skipClip;
			return null;
		});
		getTwitchClipBatch.mockResolvedValue([]);
		removeFromModQueue.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("advance mod remove failed"));
		removeFromClipQueue.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("advance clip remove failed"));
		const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

		try {
			render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "top" })} />);
			await screen.findByText("queue-catch-start");
			await waitFor(() => {
				expect(queueCall).toBeGreaterThanOrEqual(2);
			});

			const ws = MockWebSocket.instances[0];
			await sendSocketPayload(ws, { type: "command", data: { name: "skip", data: "" } });
			await screen.findByText("queue-catch-next");

			await waitFor(() => {
				expect(consoleSpy).toHaveBeenCalledWith("Failed to remove from mod queue:", expect.any(Error));
				expect(consoleSpy).toHaveBeenCalledWith("Failed to remove from clip queue:", expect.any(Error));
			});
		} finally {
			consoleSpy.mockRestore();
		}
	});

	it("advances when slot B errors while slot B is active", async () => {
		jest.useFakeTimers();
		const firstClip = buildClip("slotb-a", { title: "slotb-a", view_count: 900 });
		const secondClip = buildClip("slotb-b", { title: "slotb-b", view_count: 600 });
		const thirdClip = buildClip("slotb-c", { title: "slotb-c", view_count: 300 });
		getTwitchClipBatch.mockResolvedValue([firstClip, secondClip, thirdClip]);

		render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "top" })} />);
		await screen.findByText("slotb-a");
		await waitFor(() => {
			expect(document.querySelectorAll("video").length).toBeGreaterThanOrEqual(2);
		});

		const slotA = Array.from(document.querySelectorAll("video")).find((video) => (video as HTMLVideoElement).src.includes("slotb-a")) as HTMLVideoElement;
		const slotB = Array.from(document.querySelectorAll("video")).find((video) => (video as HTMLVideoElement).src.includes("slotb-b")) as HTMLVideoElement;
		fireEvent.canPlay(slotB);
		setVideoTiming(slotA, 10, 9.5);
		fireEvent.timeUpdate(slotA);

		await act(async () => {
			jest.advanceTimersByTime(750);
		});
		await screen.findByText("slotb-b");

		fireEvent.error(slotB);
		await screen.findByText("slotb-c");
	});

	it("advances when slot B ends while slot B is active", async () => {
		jest.useFakeTimers();
		const firstClip = buildClip("slotbend-a", { title: "slotbend-a", view_count: 900 });
		const secondClip = buildClip("slotbend-b", { title: "slotbend-b", view_count: 600 });
		const thirdClip = buildClip("slotbend-c", { title: "slotbend-c", view_count: 300 });
		getTwitchClipBatch.mockResolvedValue([firstClip, secondClip, thirdClip]);

		render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "top" })} />);
		await screen.findByText("slotbend-a");
		await waitFor(() => {
			expect(document.querySelectorAll("video").length).toBeGreaterThanOrEqual(2);
		});

		const slotA = Array.from(document.querySelectorAll("video")).find((video) => (video as HTMLVideoElement).src.includes("slotbend-a")) as HTMLVideoElement;
		const slotB = Array.from(document.querySelectorAll("video")).find((video) => (video as HTMLVideoElement).src.includes("slotbend-b")) as HTMLVideoElement;
		fireEvent.canPlay(slotB);
		setVideoTiming(slotA, 10, 9.5);
		fireEvent.timeUpdate(slotA);

		await act(async () => {
			jest.advanceTimersByTime(750);
		});
		await screen.findByText("slotbend-b");

		fireEvent.ended(slotB);
		await screen.findByText("slotbend-c");
	});

	it("clears inactive slot B prefetch when slot B errors before crossfade", async () => {
		jest.useFakeTimers();
		const firstClip = buildClip("inactiveb-a", { title: "inactiveb-a", view_count: 900 });
		const secondClip = buildClip("inactiveb-b", { title: "inactiveb-b", view_count: 600 });
		getTwitchClipBatch.mockResolvedValue([firstClip, secondClip]);

		render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "top" })} />);
		await screen.findByText("inactiveb-a");
		await waitFor(() => {
			const hasPrefetchedSlotB = Array.from(document.querySelectorAll("video")).some((video) =>
				(video as HTMLVideoElement).src.includes("inactiveb-b"),
			);
			expect(hasPrefetchedSlotB).toBe(true);
		});

		const slotA = Array.from(document.querySelectorAll("video")).find((video) => (video as HTMLVideoElement).src.includes("inactiveb-a")) as
			| HTMLVideoElement
			| undefined;
		const slotB = Array.from(document.querySelectorAll("video")).find((video) => (video as HTMLVideoElement).src.includes("inactiveb-b")) as
			| HTMLVideoElement
			| undefined;
		expect(slotA).toBeTruthy();
		expect(slotB).toBeTruthy();

		fireEvent.error(slotB!);
		fireEvent.canPlay(slotB!);
		setVideoTiming(slotA!, 10, 9.5);
		fireEvent.timeUpdate(slotA!);

		await act(async () => {
			jest.advanceTimersByTime(2_000);
		});

		expect(screen.getByText("inactiveb-a")).toBeInTheDocument();
		expect(screen.queryByText("inactiveb-b")).not.toBeInTheDocument();
	});

	it("clears inactive slot A prefetch when slot A errors while slot B is active", async () => {
		jest.useFakeTimers();
		const firstClip = buildClip("inactivea-a", { title: "inactivea-a", view_count: 900 });
		const secondClip = buildClip("inactivea-b", { title: "inactivea-b", view_count: 600 });
		const thirdClip = buildClip("inactivea-c", { title: "inactivea-c", view_count: 300 });
		getTwitchClipBatch.mockResolvedValue([firstClip, secondClip, thirdClip]);

		render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "top" })} />);
		await screen.findByText("inactivea-a");
		await waitFor(() => {
			expect(document.querySelectorAll("video").length).toBeGreaterThanOrEqual(2);
		});

		const initialSlotA = Array.from(document.querySelectorAll("video")).find((video) => (video as HTMLVideoElement).src.includes("inactivea-a")) as
			| HTMLVideoElement
			| undefined;
		const initialSlotB = Array.from(document.querySelectorAll("video")).find((video) => (video as HTMLVideoElement).src.includes("inactivea-b")) as
			| HTMLVideoElement
			| undefined;
		expect(initialSlotA).toBeTruthy();
		expect(initialSlotB).toBeTruthy();

		fireEvent.canPlay(initialSlotB!);
		setVideoTiming(initialSlotA!, 10, 9.5);
		fireEvent.timeUpdate(initialSlotA!);

		await act(async () => {
			jest.advanceTimersByTime(750);
		});
		await screen.findByText("inactivea-b");
		await waitFor(() => {
			const hasPrefetchedSlotA = Array.from(document.querySelectorAll("video")).some((video) =>
				(video as HTMLVideoElement).src.includes("inactivea-c"),
			);
			expect(hasPrefetchedSlotA).toBe(true);
		});

		const prefetchedSlotA = Array.from(document.querySelectorAll("video")).find((video) => (video as HTMLVideoElement).src.includes("inactivea-c")) as
			| HTMLVideoElement
			| undefined;
		const activeSlotB = Array.from(document.querySelectorAll("video")).find((video) => (video as HTMLVideoElement).src.includes("inactivea-b")) as
			| HTMLVideoElement
			| undefined;
		expect(prefetchedSlotA).toBeTruthy();
		expect(activeSlotB).toBeTruthy();

		fireEvent.error(prefetchedSlotA!);
		fireEvent.canPlay(prefetchedSlotA!);
		setVideoTiming(activeSlotB!, 10, 9.5);
		fireEvent.timeUpdate(activeSlotB!);

		await act(async () => {
			jest.advanceTimersByTime(2_000);
		});

		expect(screen.getByText("inactivea-b")).toBeInTheDocument();
		expect(screen.queryByText("inactivea-c")).not.toBeInTheDocument();
	});

	it("rebuilds the next clip from slot B when inactive slot A prefetch was cleared", async () => {
		jest.useFakeTimers();
		const firstClip = buildClip("slotb-rebuild-a", { title: "slotb-rebuild-a", view_count: 900 });
		const secondClip = buildClip("slotb-rebuild-b", { title: "slotb-rebuild-b", view_count: 600 });
		const thirdClip = buildClip("slotb-rebuild-c", { title: "slotb-rebuild-c", view_count: 300 });
		getTwitchClipBatch.mockResolvedValue([firstClip, secondClip, thirdClip]);

		render(<OverlayPlayer overlay={buildOverlay({ playbackMode: "top" })} />);
		await screen.findByText("slotb-rebuild-a");
		await waitFor(() => {
			expect(document.querySelectorAll("video").length).toBeGreaterThanOrEqual(2);
		});

		const initialSlotA = Array.from(document.querySelectorAll("video")).find((video) => (video as HTMLVideoElement).src.includes("slotb-rebuild-a")) as
			| HTMLVideoElement
			| undefined;
		const initialSlotB = Array.from(document.querySelectorAll("video")).find((video) => (video as HTMLVideoElement).src.includes("slotb-rebuild-b")) as
			| HTMLVideoElement
			| undefined;
		expect(initialSlotA).toBeTruthy();
		expect(initialSlotB).toBeTruthy();

		fireEvent.canPlay(initialSlotB!);
		setVideoTiming(initialSlotA!, 10, 9.5);
		fireEvent.timeUpdate(initialSlotA!);

		await act(async () => {
			jest.advanceTimersByTime(750);
		});
		await screen.findByText("slotb-rebuild-b");
		await waitFor(() => {
			const hasPrefetchedSlotA = Array.from(document.querySelectorAll("video")).some((video) =>
				(video as HTMLVideoElement).src.includes("slotb-rebuild-c"),
			);
			expect(hasPrefetchedSlotA).toBe(true);
		});

		const prefetchedSlotA = Array.from(document.querySelectorAll("video")).find((video) => (video as HTMLVideoElement).src.includes("slotb-rebuild-c")) as
			| HTMLVideoElement
			| undefined;
		const activeSlotB = Array.from(document.querySelectorAll("video")).find((video) => (video as HTMLVideoElement).src.includes("slotb-rebuild-b")) as
			| HTMLVideoElement
			| undefined;
		expect(prefetchedSlotA).toBeTruthy();
		expect(activeSlotB).toBeTruthy();

		fireEvent.error(prefetchedSlotA!);
		fireEvent.ended(activeSlotB!);

		await screen.findByText("slotb-rebuild-c");
	});

	it("handles invalid and failed raw media lookups without rendering broken clips", async () => {
		getTwitchClipBatch.mockResolvedValue([buildClip("invalid-media", { title: "invalid-media-clip" })]);
		const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
		const axiosSpy = jest.spyOn(axios, "post");
		axiosSpy.mockResolvedValueOnce({
			data: [
				{
					data: {
						clip: {
							videoQualities: [],
							playbackAccessToken: { signature: "", value: "" },
						},
					},
				},
			],
		} as never);

		try {
			render(<OverlayPlayer overlay={buildOverlay()} />);
			await waitFor(() => {
				expect(consoleSpy).toHaveBeenCalledWith("Invalid clip data or no video qualities available.");
			});
			expect(screen.queryByText("invalid-media-clip")).not.toBeInTheDocument();
		} finally {
			consoleSpy.mockRestore();
		}
	});

	it("falls back to empty avatar and unknown game metadata when metadata APIs fail", async () => {
		getAvatar.mockRejectedValue(new Error("avatar unavailable"));
		getGameDetails.mockRejectedValue(new Error("game unavailable"));
		getTwitchClipBatch.mockResolvedValue([
			buildClip("metadata-failure", {
				title: "metadata-failure-clip",
				game_id: "unknown-game",
			}),
		]);

		render(<OverlayPlayer overlay={buildOverlay()} />);
		await screen.findByText("metadata-failure-clip");
		await screen.findByText("Playing Unknown Game");
	});

	it("cancels late owner-avatar state updates on unmount", async () => {
		let avatarCall = 0;
		let resolveLateOwnerAvatar: ((value: string) => void) | null = null;
		getAvatar.mockImplementation(() => {
			avatarCall += 1;
			if (avatarCall === 1) {
				return new Promise<string>((resolve) => {
					resolveLateOwnerAvatar = resolve;
				});
			}
			return Promise.resolve("https://avatar.example/owner.png");
		});
		getTwitchClipBatch.mockResolvedValue([buildClip("avatar-cancel", { title: "avatar-cancel-clip" })]);

		const { unmount } = render(<OverlayPlayer overlay={buildOverlay()} />);
		await screen.findByText("avatar-cancel-clip");
		unmount();

		await act(async () => {
			resolveLateOwnerAvatar?.("https://avatar.example/late-owner.png");
		});
		expect(avatarCall).toBeGreaterThan(0);
	});
});
