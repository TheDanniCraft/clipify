import { IconBolt, IconCheck, IconCoffee, IconGift, IconMessageCircle, IconPlayerPlayFilled, IconPlus, IconPointerFilled, IconSparkles, IconUser } from "@tabler/icons-react";
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, Html5Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CLIP_CHAT_REVEAL_FRAMES, localFrame, POSITIVE_REACTION_FRAMES, RESET_VIEWER_GAIN_FRAMES, SCENE_START_FRAMES, VIEWER_GAIN_FRAMES, VIEWER_LOSS_FRAMES } from "./timeline";

const clamp = {
	extrapolateLeft: "clamp" as const,
	extrapolateRight: "clamp" as const,
};

export type ClipifyShowcaseFormat = "landscape" | "vertical" | "feed";

const LogoMark = ({ size = 64 }: { size?: number }) => (
	<svg width={size} height={size} viewBox='0 0 134.4 158' fill='none' aria-label='Clipify'>
		<defs>
			<linearGradient id='clipify-video-gradient' x1='-13.6' y1='24.8' x2='77' y2='115.4' gradientUnits='userSpaceOnUse'>
				<stop stopColor='#826aad' />
				<stop offset='0.4' stopColor='#6355a0' />
				<stop offset='0.8' stopColor='#4a4595' />
				<stop offset='1' stopColor='#413f92' />
			</linearGradient>
		</defs>
		<path d='M28.1 30.8 128.4 88.5c3.1 1.8 3.1 6.2 0 7.9l-100 57.7c-3.1 1.8-6.9-.4-6.9-4l-.3-115.4c0-3.5 3.8-5.8 6.9-4Z' fill='#2a2a65' />
		<path d='M11.5 4.8 117.8 66c3.2 1.9 3.2 6.6 0 8.4L11.9 135.5c-3.2 1.9-7.3-.5-7.3-4.2L4.2 9c0-3.7 4-6.1 7.3-4.2Z' fill='url(#clipify-video-gradient)' />
		<path d='m33.6 48.2 35.6 20.5c1.2.7 1.2 2.4 0 3.1L33.7 92.3c-1.2.7-2.7-.2-2.7-1.5v-41c-.1-1.4 1.3-2.2 2.5-1.5Z' fill='#fff' />
	</svg>
);

type ChatMessage = {
	user: string;
	color: string;
	text: string;
	reward?: boolean;
};

const initialMessages: ChatMessage[] = [
	{ user: "coffee_cat", color: "#f87171", text: "brb, grabbing water too" },
	{ user: "mod_mila", color: "#22c55e", text: "we'll hold the fort 🫡" },
];

const liveMessages: ChatMessage[] = [
	{ user: "pixel_panda", color: "#fb923c", text: "one more round!" },
	{ user: "mod_mila", color: "#22c55e", text: "that was close 😅" },
];

const clipMessages: ChatMessage[] = [
	{ user: "pixel_panda", color: "#fb923c", text: "I completely forgot about this 😂" },
	{ user: "hype_hannah", color: "#ef4444", text: "that timing was ridiculous" },
	{ user: "sub_sven", color: "#60a5fa", text: "W clip" },
	{ user: "coffee_cat", color: "#f87171", text: "okay this break screen is actually fun" },
	{ user: "mod_mila", color: "#22c55e", text: "perfect time for that replay 🔥" },
];

const rewardReactions: ChatMessage[] = [
	{ user: "hype_hannah", color: "#ef4444", text: "YESSS this one 🔥" },
	{ user: "coffee_cat", color: "#f87171", text: "no way, the comeback 😂" },
	{ user: "clip_kai", color: "#a78bfa", text: "wait, can I submit one too?" },
	{ user: "mod_mila", color: "#22c55e", text: "yep — add yours to the queue" },
	{ user: "pixel_panda", color: "#fb923c", text: "this is actually so cool" },
];

const ChatPanel = ({ mode, frame }: { mode: "live" | "quiet" | "active" | "reward"; frame: number }) => {
	const baseMessages = mode === "live" ? liveMessages : mode === "quiet" ? initialMessages : [...initialMessages, ...clipMessages];
	const messages = mode === "reward" && frame >= 104 ? [...baseMessages.slice(0, 2), ...rewardReactions] : baseMessages;
	const activeRevealFrames = CLIP_CHAT_REVEAL_FRAMES.map((globalFrame) => localFrame(globalFrame, SCENE_START_FRAMES.clipPlayback));
	const visibleCount = mode === "quiet" || mode === "live" ? 2 : mode === "reward" ? (frame >= 104 ? Math.min(messages.length, 3 + Math.floor((frame - 104) / 22)) : baseMessages.length) : Math.min(messages.length, 2 + activeRevealFrames.filter((revealFrame) => frame >= revealFrame).length);
	const menuOpen = mode === "reward" && frame >= 45 && frame < 93;
	const rewardSelected = mode === "reward" && frame >= 93;

	return (
		<div className='chat-panel'>
			<div className='chat-header'>
				<span>STREAM CHAT</span>
				<span className='chat-live'>
					<span /> LIVE
				</span>
			</div>
			<div className='chat-list'>
				{messages.slice(0, visibleCount).map((message, index) => {
					const revealAt = mode === "reward" && frame >= 104 && index >= 2 ? 104 + (index - 2) * 22 : mode === "active" && index >= 2 ? activeRevealFrames[index - 2] : 0;
					const reveal = mode === "reward" && frame < 104 ? 1 : spring({ frame: frame - revealAt, fps: 30, config: { damping: 18 } });
					return (
						<div className='chat-message' key={`${message.user}-${index}`} style={{ opacity: index < 2 ? 1 : reveal, transform: `translateY(${(1 - reveal) * 16}px)` }}>
							<strong style={{ color: message.color }}>{message.user}</strong>
							<span>{message.text}</span>
						</div>
					);
				})}
				{rewardSelected ? (
					<div className='reward-message' style={{ opacity: spring({ frame: frame - 93, fps: 30, config: { damping: 16 } }) }}>
						<div>
							<IconGift size={18} /> REWARD REDEEMED
						</div>
						<strong>pixel_panda played a clip</strong>
					</div>
				) : null}
			</div>
			{menuOpen ? (
				<div className='points-menu' style={{ opacity: spring({ frame: frame - 45, fps: 30, config: { damping: 18 } }) }}>
					<div className='points-menu-title'>USE CHANNEL POINTS</div>
					<div className='points-option points-option-selected'>
						<span className='points-option-icon'>
							<IconPlayerPlayFilled size={18} />
						</span>
						<div>
							<strong>Play a Clip</strong>
							<span>Pick the next highlight</span>
						</div>
						<b>500</b>
					</div>
					<div className='points-option'>
						<span className='points-option-icon'>
							<IconBolt size={18} />
						</span>
						<div>
							<strong>Replay Last Clip</strong>
							<span>Run that moment back</span>
						</div>
						<b>750</b>
					</div>
				</div>
			) : null}
			<div className='chat-input'>
				<div className={`points-button ${mode === "reward" && frame >= 45 ? "points-button-active" : ""}`}>
					<IconSparkles size={22} />
				</div>
				<div className='chat-placeholder'>Send a message…</div>
				<div className='chat-send'>Chat</div>
			</div>
		</div>
	);
};

const BrbVisual = ({ dim = false }: { dim?: boolean }) => (
	<div className='brb-visual' style={{ filter: dim ? "saturate(.55) brightness(.78)" : undefined }}>
		<div className='brb-orbit brb-orbit-one' />
		<div className='brb-orbit brb-orbit-two' />
		<div className='brb-icon'>
			<IconCoffee size={68} stroke={1.7} />
		</div>
		<div className='brb-title'>BE RIGHT BACK</div>
		<div className='brb-subtitle'>The stream will continue shortly</div>
	</div>
);

const ClipVisual = ({ frame, queued = false, alternate = false, live = false }: { frame: number; queued?: boolean; alternate?: boolean; live?: boolean }) => {
	const orbX = 485 + Math.sin(frame / 34) * 390;
	const orbY = 275 + Math.sin(frame / 22) * 92;

	return (
		<div className={`clip-visual ${alternate ? "clip-visual-alternate" : ""}`}>
			<div className='game-grid' />
			<div className='game-glow game-glow-a' />
			<div className='game-glow game-glow-b' />
			<div className='game-platform platform-a' />
			<div className='game-platform platform-b' />
			<div className='player-orb' style={{ transform: `translate(${orbX}px, ${orbY}px) rotate(${frame * 2}deg)` }}>
				<IconBolt size={30} stroke={2.8} />
			</div>
			<div className='clip-badge'>
				<IconPlayerPlayFilled size={16} /> {live ? "LIVE GAMEPLAY" : "CLIP REPLAY"}
			</div>
			{queued ? (
				<div className='queue-badge'>
					<IconCheck size={17} /> Added to queue
				</div>
			) : null}
			<div className='clip-meta'>
				<div className='clip-title'>{live ? "One more round" : alternate ? "The impossible comeback" : "The escape nobody expected"}</div>
				<div className='clip-author'>{live ? "your channel · Live now" : "your channel · Highlight"}</div>
			</div>
		</div>
	);
};

type ReactionVariant = "negative" | "positive" | "recovery";

type FloatingReaction = {
	label: string;
	at: number;
	x: number;
	y: number;
	rotation: number;
};

const negativeReactionLabels = ["−1", "😴", "🥱", "😭", "🪦", "💀"];
const negativeReactionPositions = [
	[16, 23, -8],
	[77, 19, 7],
	[29, 72, -5],
	[67, 68, 9],
	[47, 31, -7],
	[86, 48, 6],
] as const;

const positiveReactionLabels = ["🔥", "+1", "😂", "W", "✨", "🤯", "💜", "👏", "😮", "⚡", "🙌", "💯", "🚀", "🎉"];
const positiveReactionPositions = [
	[13, 19, -8],
	[74, 16, 7],
	[28, 68, -5],
	[83, 61, 9],
	[51, 26, -7],
	[9, 78, 6],
	[69, 80, -9],
	[34, 39, 8],
	[88, 37, -5],
	[51, 72, 6],
	[21, 43, -7],
	[78, 76, 8],
	[61, 15, -6],
	[39, 80, 7],
] as const;

const recoveryReactionPositions = [
	[38, 22, -7],
	[65, 29, 6],
	[26, 57, -5],
	[77, 63, 7],
	[48, 73, -6],
	[86, 39, 5],
] as const;

const FloatingReactions = ({ variant, frame }: { variant: ReactionVariant; frame: number }) => {
	let events: FloatingReaction[];
	if (variant === "negative") {
		events = VIEWER_LOSS_FRAMES.map((globalFrame, index) => ({
			label: negativeReactionLabels[index],
			at: localFrame(globalFrame, SCENE_START_FRAMES.withoutClipify),
			x: negativeReactionPositions[index][0],
			y: negativeReactionPositions[index][1],
			rotation: negativeReactionPositions[index][2],
		}));
	} else if (variant === "recovery") {
		events = RESET_VIEWER_GAIN_FRAMES.map((globalFrame, index) => ({
			label: "+1",
			at: localFrame(globalFrame, SCENE_START_FRAMES.addClipify),
			x: recoveryReactionPositions[index][0],
			y: recoveryReactionPositions[index][1],
			rotation: recoveryReactionPositions[index][2],
		}));
	} else {
		events = POSITIVE_REACTION_FRAMES.map((globalFrame, index) => ({
			label: positiveReactionLabels[index],
			at: localFrame(globalFrame, SCENE_START_FRAMES.clipPlayback),
			x: positiveReactionPositions[index][0],
			y: positiveReactionPositions[index][1],
			rotation: positiveReactionPositions[index][2],
		}));
	}

	return (
		<div className={`reaction-layer reaction-layer-${variant}`}>
			{events.map((event, index) => {
				const entrance = spring({ frame: frame - event.at, fps: 30, config: { damping: 13, stiffness: 190, mass: 0.72 } });
				const fade = interpolate(frame, [event.at + 54, event.at + 90], [1, 0], clamp);
				const drift = interpolate(frame, [event.at, event.at + 90], [18, -30], clamp);
				return (
					<div
						className='stream-reaction'
						key={`${variant}-${event.label}-${index}`}
						style={{
							left: `${event.x}%`,
							top: `${event.y}%`,
							opacity: entrance * fade,
							transform: `translate(-50%, calc(-50% + ${drift}px)) rotate(${event.rotation}deg) scale(${0.55 + entrance * 0.45})`,
						}}
					>
						{event.label}
					</div>
				);
			})}
		</div>
	);
};

const rewardBurstLabels = ["🔥", "W", "😂", "🤯", "💜", "👏", "⚡", "💯", "🚀", "🎉", "🙌", "✨"];
const rewardBurstPositions = [
	[13, 18],
	[32, 10],
	[53, 16],
	[76, 11],
	[89, 25],
	[82, 48],
	[91, 72],
	[68, 83],
	[47, 75],
	[28, 86],
	[10, 68],
	[19, 43],
] as const;

const RewardReactionStream = ({ frame }: { frame: number }) => (
	<div className='reward-reaction-field'>
		{rewardBurstLabels.map((label, index) => {
			const delay = [0, 4, 8, 13, 17, 22, 27, 31, 36, 41, 46, 50][index];
			const appearAt = 96 + delay;
			const entrance = spring({ frame: frame - appearAt, fps: 30, config: { damping: 13, stiffness: 190, mass: 0.72 } });
			const fade = interpolate(frame, [appearAt + 38, appearAt + 62], [1, 0], clamp);
			const drift = interpolate(frame, [appearAt, appearAt + 62], [14, -24], clamp);
			const [targetX, targetY] = rewardBurstPositions[index];
			return (
				<div
					className='reward-reaction-box'
					key={`${label}-${index}`}
					style={{
						left: `${targetX}%`,
						top: `${targetY}%`,
						opacity: entrance * fade,
						transform: `translate(-50%, calc(-50% + ${drift}px)) rotate(${(index % 2 ? 1 : -1) * (1 - entrance) * 14}deg) scale(${0.55 + entrance * 0.45})`,
					}}
				>
					{label}
				</div>
			);
		})}
	</div>
);

type StreamMockProps = {
	mode: "live" | "brb" | "clip" | "reward";
	viewerCount: number;
	frame: number;
	visualFrame?: number;
	chatFrame?: number;
	dim?: boolean;
	transitionToBrb?: number;
	reactions?: ReactionVariant;
	reactionFrame?: number;
};

const StreamMock = ({ mode, viewerCount, frame, visualFrame = frame, chatFrame = frame, dim = false, transitionToBrb, reactions, reactionFrame = frame }: StreamMockProps) => {
	const rewardPlayed = mode === "reward" && frame >= 93;
	const viewerPulse = mode === "clip" || mode === "reward" ? 1 + Math.max(0, Math.sin(visualFrame / 5)) * 0.08 : 1;
	const cameraScale = 1 + Math.sin(visualFrame / 64) * 0.005;
	const cameraOffset = Math.sin(visualFrame / 38) * 4;
	const transitioningToBrb = transitionToBrb !== undefined;
	const brbProgress = transitionToBrb ?? 0;
	const displayMode = transitioningToBrb && brbProgress >= 0.55 ? "brb" : mode;
	const status = displayMode === "live" ? "One more round · Live now" : displayMode === "brb" ? "Taking a quick break" : "Best moments · Powered by Clipify";
	const elapsedSeconds = 40 + Math.floor(visualFrame / 30);
	const clockMinutes = 18 + Math.floor(elapsedSeconds / 60);
	const clockSeconds = elapsedSeconds % 60;

	return (
		<div className='stream-camera' style={{ transform: `translateY(${cameraOffset}px) scale(${cameraScale})` }}>
			<div className='stream-shell'>
				<div className='studio-titlebar'>
					<div className='window-dots'>
						<span />
						<span />
						<span />
					</div>
					<span>OBS Studio — Scene: Stream</span>
					<span className='studio-status'>60 FPS</span>
				</div>
				<div className='stream-layout'>
					<div className='player-column'>
						<div className='stream-meta-bar'>
							<div className='live-pill'>LIVE</div>
							<div className='stream-name'>
								<strong>Your channel</strong>
								<span>{status}</span>
							</div>
							<div className='viewer-count' style={{ transform: `scale(${viewerPulse})` }}>
								<IconUser size={24} fill='currentColor' stroke={2.2} />
								<span>{viewerCount}</span>
							</div>
						</div>
						<div className='player-stage'>
							{transitioningToBrb ? (
								<>
									<div className='player-transition-layer'>
										<BrbVisual dim={dim} />
									</div>
									<div className='player-transition-layer' style={{ opacity: 1 - brbProgress }}>
										<ClipVisual frame={visualFrame} live />
									</div>
								</>
							) : mode === "brb" ? (
								<BrbVisual dim={dim} />
							) : (
								<ClipVisual frame={visualFrame} live={mode === "live"} queued={rewardPlayed} alternate={rewardPlayed} />
							)}
							{mode === "reward" ? <div className='clip-switch-flash' style={{ opacity: interpolate(frame, [91, 96, 104], [0, 0.9, 0], clamp) }} /> : null}
							{mode === "reward" ? <RewardReactionStream frame={frame} /> : null}
							{reactions ? <FloatingReactions variant={reactions} frame={reactionFrame} /> : null}
						</div>
						<div className='studio-footer'>
							<div>
								<span className='status-dot' /> LIVE 00:{String(clockMinutes).padStart(2, "0")}:{String(clockSeconds).padStart(2, "0")}
							</div>
							<div>CPU 3.8% · 60.00 FPS</div>
						</div>
					</div>
					<ChatPanel mode={displayMode === "live" ? "live" : displayMode === "brb" ? "quiet" : displayMode === "reward" ? "reward" : "active"} frame={chatFrame} />
				</div>
			</div>
		</div>
	);
};

const SceneFrame = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
	<AbsoluteFill className='scene' style={style}>
		{children}
	</AbsoluteFill>
);

const Headline = ({ eyebrow, title, detail }: { eyebrow?: string; title: ReactNode; detail?: string }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const entrance = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
	return (
		<div className='headline' style={{ opacity: entrance, transform: `translateY(${(1 - entrance) * 24}px)` }}>
			{eyebrow ? <div className='eyebrow'>{eyebrow}</div> : null}
			<div className='headline-title'>{title}</div>
			{detail ? <div className='headline-detail'>{detail}</div> : null}
		</div>
	);
};

const ProblemScene = () => {
	const frame = useCurrentFrame();
	const toBreak = interpolate(frame, [92, 119], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
	return (
		<SceneFrame>
			<div style={{ opacity: 1 - toBreak }}>
				<Headline eyebrow="LIVE DOESN'T WAIT" title={<>Need to step away?</>} />
			</div>
			<div className='mock-wrap'>
				<StreamMock mode='live' viewerCount={10} frame={frame} visualFrame={frame} transitionToBrb={toBreak} />
			</div>
		</SceneFrame>
	);
};

const WithoutScene = () => {
	const frame = useCurrentFrame();
	const localLossFrames = VIEWER_LOSS_FRAMES.map((globalFrame) => localFrame(globalFrame, SCENE_START_FRAMES.withoutClipify));
	const count = 10 - localLossFrames.filter((lossFrame) => frame >= lossFrame).length;
	return (
		<SceneFrame>
			<Headline eyebrow='WITHOUT CLIPIFY' title={<>A static break loses the room.</>} />
			<div className='mock-wrap'>
				<StreamMock mode='brb' viewerCount={count} frame={frame} visualFrame={120 + frame} />
			</div>
		</SceneFrame>
	);
};

const ResetScene = ({ format }: { format: ClipifyShowcaseFormat }) => {
	const frame = useCurrentFrame();
	const { fps, width, height } = useVideoConfig();
	const localRecoveryFrames = RESET_VIEWER_GAIN_FRAMES.map((globalFrame) => localFrame(globalFrame, SCENE_START_FRAMES.addClipify));
	const recoveredViewerCount = 4 + localRecoveryFrames.filter((gainFrame) => frame >= gainFrame).length;
	const copy = spring({ frame: frame - 2, fps, config: { damping: 18, stiffness: 88 } });
	const drop = spring({ frame: frame - 42, fps, config: { damping: 14, stiffness: 68, mass: 1.08 } });
	const blast = interpolate(frame, [78, 118], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
	const bombOpacity = interpolate(frame, [38, 48, 83, 110], [0, 1, 1, 0], clamp);
	const buttonExit = interpolate(frame, [27, 32, 40], [0, 0.2, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
	const buttonPress = interpolate(frame, [24, 28, 33], [0, 1, 0], clamp);
	const resetPointer = format === "landscape" ? { startX: 1460, startY: 730, targetX: 1102, targetY: 382 } : format === "vertical" ? { startX: width - 92, startY: height * 0.72, targetX: width * 0.56, targetY: height * 0.38 } : { startX: width - 92, startY: height * 0.69, targetX: width * 0.56, targetY: height * 0.395 };
	const pointerX = interpolate(frame, [0, 8, 22, 40], [resetPointer.startX, resetPointer.startX, resetPointer.targetX, resetPointer.targetX], clamp);
	const pointerY = interpolate(frame, [0, 8, 22, 40], [resetPointer.startY, resetPointer.startY, resetPointer.targetY, resetPointer.targetY], clamp);
	const pointerOpacity = interpolate(frame, [0, 6, 32, 42], [0, 1, 1, 0], clamp);
	const pointerClick = interpolate(frame, [24, 28, 33], [0, 1, 0], clamp);
	return (
		<SceneFrame>
			<div className='mock-wrap bomb-stage'>
				<div className='bomb-screen bomb-screen-muted'>
					<StreamMock mode='brb' viewerCount={4} frame={frame} visualFrame={285 + frame} />
				</div>
				<div className='bomb-screen bomb-screen-reveal' style={{ clipPath: `circle(${blast * 145}% at 50% ${format === "feed" ? 35.7 : 50}%)` }}>
					<StreamMock mode='clip' viewerCount={recoveredViewerCount} frame={frame} visualFrame={285 + frame} chatFrame={0} />
				</div>
			</div>
			<div className='reset-impact'>
				<div className='impact-halo' style={{ opacity: interpolate(blast, [0, 0.12, 0.72, 1], [0, 1, 0.55, 0], clamp), transform: `scale(${0.35 + blast * 12})` }} />
				{Array.from({ length: 14 }).map((_, index) => {
					const angle = (Math.PI * 2 * index) / 14;
					const distance = blast * 520;
					return <div key={index} className='impact-shard' style={{ transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) rotate(${index * 31 + blast * 150}deg) scale(${1 - blast * 0.45})`, opacity: interpolate(blast, [0, 0.1, 0.8, 1], [0, 1, 0.45, 0], clamp) }} />;
				})}
				<div className='drop-logo' style={{ opacity: bombOpacity, transform: `translateY(${interpolate(drop, [0, 1], [-560, 0], clamp)}px) rotate(${interpolate(drop, [0, 1], [-20, 0], clamp)}deg) scale(${interpolate(blast, [0, 0.12, 1], [1, 1.22, 0.5], clamp)})` }}>
					<LogoMark size={172} />
				</div>
				<div
					className='reset-copy'
					style={{
						opacity: copy * (1 - buttonExit),
						filter: `blur(${buttonExit * 7}px) brightness(${1 + buttonPress * 0.22})`,
						transform: `translate(-50%, -50%) translateX(${(1 - copy) * -120}px) scale(${(1 - buttonPress * 0.08) * (1 - buttonExit * 0.28)})`,
					}}
				>
					<IconPlus size={28} stroke={2.6} />
					<strong>Add Clipify</strong>
				</div>
				<div className='click-ring' style={{ left: pointerX - 26, top: pointerY - 26, opacity: pointerClick, transform: `scale(${0.5 + pointerClick})` }} />
				<div className='tabler-pointer' style={{ left: pointerX, top: pointerY, opacity: pointerOpacity, transform: `scale(${1 - pointerClick * 0.14})` }}>
					<IconPointerFilled size={46} />
				</div>
			</div>
		</SceneFrame>
	);
};

const ClipifyScene = () => {
	const frame = useCurrentFrame();
	const localGainFrames = VIEWER_GAIN_FRAMES.map((globalFrame) => localFrame(globalFrame, SCENE_START_FRAMES.clipPlayback));
	const count = 10 + localGainFrames.filter((gainFrame) => frame >= gainFrame).length;
	return (
		<SceneFrame>
			<Headline
				eyebrow='WITH CLIPIFY'
				title={
					<>
						Turn downtime into <span className='gradient-text'>clip time.</span>
					</>
				}
			/>
			<div className='mock-wrap'>
				<StreamMock mode='clip' viewerCount={count} frame={frame} visualFrame={405 + frame} />
			</div>
		</SceneFrame>
	);
};

const Cursor = ({ frame, format }: { frame: number; format: ClipifyShowcaseFormat }) => {
	const { width, height } = useVideoConfig();
	const cursorPath = format === "landscape" ? { startX: 1810, startY: 990, pointsX: 1480, pointsY: 994, rewardX: 1580, rewardY: 840 } : format === "vertical" ? { startX: width - 70, startY: height - 90, pointsX: 88, pointsY: height - 140, rewardX: 300, rewardY: height - 300 } : { startX: width - 70, startY: height - 58, pointsX: 82, pointsY: height - 72, rewardX: 300, rewardY: height - 222 };
	const x = interpolate(frame, [0, 40, 58, 82, 110], [cursorPath.startX, cursorPath.pointsX, cursorPath.pointsX, cursorPath.rewardX, cursorPath.rewardX], clamp);
	const y = interpolate(frame, [0, 40, 58, 82, 110], [cursorPath.startY, cursorPath.pointsY, cursorPath.pointsY, cursorPath.rewardY, cursorPath.rewardY], clamp);
	const firstClick = interpolate(frame, [40, 46, 52], [0, 1, 0], clamp);
	const secondClick = interpolate(frame, [82, 88, 94], [0, 1, 0], clamp);
	const click = Math.max(firstClick, secondClick);
	const cursorOpacity = interpolate(frame, [0, 8, 98, 112], [0, 1, 1, 0], clamp);
	return (
		<>
			<div className='click-ring' style={{ left: x - 26, top: y - 26, opacity: click, transform: `scale(${0.5 + click})` }} />
			<div className='tabler-pointer' style={{ left: x, top: y, opacity: cursorOpacity, transform: `scale(${1 - click * 0.14})` }}>
				<IconPointerFilled size={46} />
			</div>
		</>
	);
};

const RewardScene = ({ format }: { format: ClipifyShowcaseFormat }) => {
	const frame = useCurrentFrame();
	const exit = interpolate(frame, [210, 232], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
	return (
		<SceneFrame style={{ opacity: 1 - exit, transform: `translateY(${exit * 48}px) scale(${1 - exit * 0.015})` }}>
			<Headline eyebrow='BUILT FOR YOUR COMMUNITY' title={<>Viewers can join in, too.</>} />
			<div className='mock-wrap'>
				<StreamMock mode='reward' viewerCount={14} frame={frame} visualFrame={765 + frame} />
			</div>
			<Cursor frame={frame} format={format} />
		</SceneFrame>
	);
};

const SummaryScene = () => {
	const frame = useCurrentFrame();
	const gridEnter = interpolate(frame, [0, 18], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
	const contentEnter = interpolate(frame, [12, 30], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
	const exitProgress = (start: number) => interpolate(frame, [start, 181], [0, 1], clamp);
	const brandExit = exitProgress(140);
	const firstLineExit = exitProgress(145);
	const secondLineExit = exitProgress(151);
	const cards = [
		{ icon: <IconPlayerPlayFilled />, label: "Your clips", detail: "Ready when you step away" },
		{ icon: <IconMessageCircle />, label: "Your community", detail: "Still part of the moment" },
		{ icon: <IconBolt />, label: "Your stream", detail: "Still moving" },
	];
	return (
		<SceneFrame>
			<div className='summary-grid' style={{ opacity: gridEnter }} />
			<div className='summary-brand' style={{ opacity: contentEnter * (1 - brandExit), transform: `translateY(${(1 - contentEnter) * 28 + brandExit * 28}px)`, filter: `blur(${brandExit * 3}px)` }}>
				<LogoMark size={70} />
				<span>Clipify</span>
			</div>
			<div className='summary-title' style={{ opacity: contentEnter, transform: `translateY(${(1 - contentEnter) * 28}px)` }}>
				<div className='summary-title-line' style={{ opacity: 1 - firstLineExit, transform: `translateY(${firstLineExit * 44}px)` }}>
					A better break screen,
				</div>
				<div className='summary-title-line gradient-text' style={{ opacity: 1 - secondLineExit, transform: `translateY(${secondLineExit * 44}px)` }}>
					already filled with your best moments.
				</div>
			</div>
			<div className='feature-cards' style={{ opacity: contentEnter, transform: `translateY(${(1 - contentEnter) * 28}px)` }}>
				{cards.map((card, index) => {
					const enter = interpolate(frame, [22 + index * 16, 40 + index * 16], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
					const exit = exitProgress(148 + index * 5);
					return (
						<div className='feature-card-slot' key={card.label}>
							<div className={`feature-card feature-card-${index + 1}`} style={{ opacity: enter * (1 - exit), transform: `translateY(${(1 - enter) * 36 + exit * 52}px)`, filter: `blur(${exit * 4}px)` }}>
								<div className='feature-icon'>{card.icon}</div>
								<strong>{card.label}</strong>
								<span>{card.detail}</span>
							</div>
						</div>
					);
				})}
			</div>
		</SceneFrame>
	);
};

const celebrationEmojis = ["🔥", "😂", "✨", "🤯", "💜", "👏", "🚀", "🎉", "⚡", "🙌", "💯", "😍", "🎮", "🏆"];
const celebrationPositions = [
	[8, 18],
	[24, 9],
	[43, 12],
	[67, 8],
	[88, 19],
	[93, 42],
	[87, 72],
	[72, 88],
	[52, 91],
	[30, 88],
	[11, 75],
	[6, 49],
	[20, 34],
	[79, 34],
] as const;

const CelebrationField = ({ frame }: { frame: number }) => (
	<div className='celebration-field'>
		{celebrationEmojis.map((emoji, index) => {
			const delay = [0, 4, 2, 7, 1, 6, 3, 9, 5, 8, 2, 7, 4, 10][index];
			const spread = spring({ frame: frame - 5 - delay, fps: 30, config: { damping: 14, stiffness: 145, mass: 0.75 } });
			const ambient = interpolate(frame, [30 + delay, 54 + delay], [0, 1], clamp);
			const phase = frame + index * 17;
			const motionKind = index % 3;
			const wiggleX = motionKind === 2 ? Math.sin(phase / 15) * 4 * ambient : Math.sin(phase / 24) * 1.5 * ambient;
			const floatY = motionKind === 0 ? Math.sin(phase / 18) * 4.5 * ambient : Math.sin(phase / 27) * 2 * ambient;
			const ambientRotation = motionKind === 0 ? Math.sin(phase / 16) * 3.2 * ambient : Math.sin(phase / 28) * 1.2 * ambient;
			const breathe = 1 + (motionKind === 1 ? Math.sin(phase / 13) * 0.06 : Math.sin(phase / 22) * 0.025) * ambient;
			const [targetX, targetY] = celebrationPositions[index];
			const left = 50 + (targetX - 50) * spread;
			const top = 50 + (targetY - 50) * spread;
			return (
				<div
					className='celebration-emoji'
					key={`${emoji}-${index}`}
					style={{
						left: `${left}%`,
						top: `${top}%`,
						opacity: spread * 0.86,
						transform: `translate(-50%, -50%) translate(${wiggleX}px, ${floatY}px) rotate(${(index % 2 ? 1 : -1) * (1 - spread) * 24 + ambientRotation}deg) scale(${(0.35 + spread * 0.65) * breathe})`,
					}}
				>
					{emoji}
				</div>
			);
		})}
	</div>
);

const PersistentStreamReactions = ({ variant, sceneStart }: { variant: ReactionVariant; sceneStart: number }) => {
	const frame = useCurrentFrame();
	const cameraScale = 1 + Math.sin(frame / 64) * 0.005;
	const cameraOffset = Math.sin(frame / 38) * 4;
	return (
		<div className='persistent-reaction-viewport' style={{ transform: `translateY(${cameraOffset}px) scale(${cameraScale})` }}>
			<FloatingReactions variant={variant} frame={frame - sceneStart} />
		</div>
	);
};

const EndScene = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const enter = spring({ frame: frame + 4, fps, config: { damping: 16 } });
	return (
		<SceneFrame>
			<div className='end-glow' />
			<CelebrationField frame={frame} />
			<div className='end-card' style={{ opacity: enter, transform: `scale(${0.9 + enter * 0.1})` }}>
				<LogoMark size={138} />
				<div className='end-wordmark'>Clipify</div>
				<div className='end-title'>Make every break part of the stream.</div>
				<div className='end-cta'>
					Try it on your next stream: <span>clipify.us</span>
				</div>
			</div>
		</SceneFrame>
	);
};

export const ClipifyShowcase = ({ format = "landscape" }: { format?: ClipifyShowcaseFormat }) => (
	<AbsoluteFill className={`video-root video-root--${format}`}>
		<Html5Audio src={staticFile("clipify-showcase/audio/clipify-trailer-original.wav")} volume={0.82} />
		<div className='background-grid' />
		<div className='background-glow glow-one' />
		<div className='background-glow glow-two' />
		<Sequence from={0} durationInFrames={120}>
			<ProblemScene />
		</Sequence>
		<Sequence from={120} durationInFrames={165}>
			<WithoutScene />
		</Sequence>
		<Sequence from={285} durationInFrames={120}>
			<ResetScene format={format} />
		</Sequence>
		<Sequence from={405} durationInFrames={360}>
			<ClipifyScene />
		</Sequence>
		<Sequence from={765} durationInFrames={233}>
			<RewardScene format={format} />
		</Sequence>
		<Sequence from={975} durationInFrames={180}>
			<SummaryScene />
		</Sequence>
		<Sequence from={1155} durationInFrames={195}>
			<EndScene />
		</Sequence>
		<PersistentStreamReactions variant='negative' sceneStart={SCENE_START_FRAMES.withoutClipify} />
		<PersistentStreamReactions variant='recovery' sceneStart={SCENE_START_FRAMES.addClipify} />
		<PersistentStreamReactions variant='positive' sceneStart={SCENE_START_FRAMES.clipPlayback} />
	</AbsoluteFill>
);
