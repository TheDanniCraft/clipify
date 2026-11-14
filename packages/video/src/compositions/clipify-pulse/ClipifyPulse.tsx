import { IconArrowUpRight, IconBrandTwitch, IconCheck, IconGripVertical, IconPlayerPauseFilled, IconPlayerPlayFilled, IconPlayerTrackNextFilled, IconSparkles } from "@tabler/icons-react";
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, Html5Audio, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CLIPIFY_PULSE_DURATION_IN_FRAMES, PULSE_CUE_FRAMES, PULSE_SCENE_STARTS, pulseLocalFrame } from "./timeline";
import "./styles.css";

const clamp = {
	extrapolateLeft: "clamp" as const,
	extrapolateRight: "clamp" as const,
};

const LogoMark = ({ size = 58 }: { size?: number }) => (
	<svg width={size} height={size} viewBox='0 0 134.4 158' fill='none' aria-label='Clipify'>
		<defs>
			<linearGradient id='pulse-logo-gradient' x1='-13.6' y1='24.8' x2='77' y2='115.4' gradientUnits='userSpaceOnUse'>
				<stop stopColor='#826aad' />
				<stop offset='0.4' stopColor='#6355a0' />
				<stop offset='0.8' stopColor='#4a4595' />
				<stop offset='1' stopColor='#413f92' />
			</linearGradient>
		</defs>
		<path d='M28.1 30.8 128.4 88.5c3.1 1.8 3.1 6.2 0 7.9l-100 57.7c-3.1 1.8-6.9-.4-6.9-4l-.3-115.4c0-3.5 3.8-5.8 6.9-4Z' fill='#262259' />
		<path d='M11.5 4.8 117.8 66c3.2 1.9 3.2 6.6 0 8.4L11.9 135.5c-3.2 1.9-7.3-.5-7.3-4.2L4.2 9c0-3.7 4-6.1 7.3-4.2Z' fill='url(#pulse-logo-gradient)' />
		<path d='m33.6 48.2 35.6 20.5c1.2.7 1.2 2.4 0 3.1L33.7 92.3c-1.2.7-2.7-.2-2.7-1.5v-41c-.1-1.4 1.3-2.2 2.5-1.5Z' fill='#fff' />
	</svg>
);

const sceneOpacity = (frame: number, start: number, end: number, fade = 10) => {
	if (start === 0) return interpolate(frame, [start, end - fade, end], [1, 1, 0], clamp);
	return interpolate(frame, [start - fade, start, end - fade, end], [0, 1, 1, 0], clamp);
};

const BrandBug = () => (
	<div className='pulse-brand-bug'>
		<LogoMark size={34} />
		<span>CLIPIFY</span>
	</div>
);

const Chrome = () => {
	const frame = useCurrentFrame();
	return (
		<>
			<div className='pulse-spectral-edge pulse-spectral-edge--top' style={{ transform: `translateX(${Math.sin(frame / 34) * 2.5}%) scaleX(1.06)` }} />
			<div className='pulse-spectral-edge pulse-spectral-edge--bottom' style={{ transform: `translateX(${Math.sin(frame / 41 + 1.8) * -2.5}%) scaleX(1.06)` }} />
			<div className='pulse-grain' />
			<BrandBug />
		</>
	);
};

const AccentGlow = ({ color, style }: { color: string; style?: CSSProperties }) => <div className='pulse-accent-glow' style={{ background: color, ...style }} />;

const WordReveal = ({ children, frame, at, className = "" }: { children: ReactNode; frame: number; at: number; className?: string }) => {
	const progress = spring({ frame: frame - at, fps: 30, config: { damping: 18, stiffness: 185, mass: 0.7 } });
	return (
		<div className={`pulse-word-mask ${className}`}>
			<div style={{ opacity: progress, transform: `translateY(${(1 - progress) * 115}%) skewY(${(1 - progress) * 4}deg)` }}>{children}</div>
		</div>
	);
};

type ProductFrameProps = {
	src: string;
	label: string;
	className?: string;
	style?: CSSProperties;
	imageStyle?: CSSProperties;
};

const ProductFrame = ({ src, label, className = "", style, imageStyle }: ProductFrameProps) => (
	<div className={`pulse-product-frame ${className}`} style={style}>
		<div className='pulse-window-bar'>
			<div className='pulse-window-dots'>
				<span />
				<span />
				<span />
			</div>
			<div className='pulse-window-label'>{label}</div>
			<div className='pulse-window-live'>LIVE</div>
		</div>
		<div className='pulse-product-viewport'>
			<Img src={staticFile(src)} style={imageStyle} />
		</div>
	</div>
);

const OpeningScene = () => {
	const frame = useCurrentFrame();
	const opacity = sceneOpacity(frame, PULSE_SCENE_STARTS.opening, PULSE_SCENE_STARTS.playlist, 8);
	const exit = interpolate(frame, [62, 75], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
	return (
		<AbsoluteFill className='pulse-scene pulse-opening' style={{ opacity, transform: `translateX(${-exit * 170}px) scale(${1 + exit * 0.05})` }}>
			<AccentGlow color='#6355a0' style={{ left: "55%", top: "8%" }} />
			<AccentGlow color='#826aad' style={{ left: "76%", top: "52%", opacity: 0.34 }} />
			<div className='pulse-opening-copy'>
				<div className='pulse-kicker'>YOUR STREAM DOESN&apos;T PAUSE</div>
				<WordReveal frame={frame} at={0}>
					TAKE THE BREAK.
				</WordReveal>
				<WordReveal frame={frame} at={18} className='pulse-word-accent'>
					KEEP THE STREAM.
				</WordReveal>
				<WordReveal frame={frame} at={38}>
					MOVING.
				</WordReveal>
			</div>
			<div className='pulse-opening-orbit' style={{ transform: `rotate(${frame * 0.7}deg)` }}>
				<div className='pulse-opening-logo'>
					<LogoMark size={116} />
				</div>
				<div className='pulse-orbit-dot pulse-orbit-dot--a' />
				<div className='pulse-orbit-dot pulse-orbit-dot--b' />
			</div>
		</AbsoluteFill>
	);
};

const PlaylistScene = () => {
	const frame = useCurrentFrame();
	const local = pulseLocalFrame(frame, PULSE_SCENE_STARTS.playlist);
	const opacity = sceneOpacity(frame, PULSE_SCENE_STARTS.playlist, PULSE_SCENE_STARTS.style, 9);
	const productIn = spring({ frame: local, fps: 30, config: { damping: 18, stiffness: 150, mass: 0.85 } });
	const pan = interpolate(local, [0, 105], [0, -52], clamp);
	const snap = spring({ frame: local - pulseLocalFrame(PULSE_CUE_FRAMES.playlistSnap, PULSE_SCENE_STARTS.playlist), fps: 30, config: { damping: 16, stiffness: 210, mass: 0.65 } });
	return (
		<AbsoluteFill className='pulse-scene pulse-feature-scene pulse-playlist-scene' style={{ opacity }}>
			<AccentGlow color='#6355a0' style={{ left: "70%", top: "45%", opacity: 0.65 }} />
			<div className='pulse-feature-copy'>
				<div className='pulse-step'>01 / BUILD THE LINEUP</div>
				<WordReveal frame={local} at={4}>
					PICK THE
				</WordReveal>
				<WordReveal frame={local} at={12} className='pulse-word-accent'>
					CLIPS.
				</WordReveal>
				<p>Choose the moments your viewers already love.</p>
				<div className='pulse-chip-row'>
					<span>SELECT</span>
					<span>ORDER</span>
					<span>PLAY</span>
				</div>
			</div>
			<ProductFrame src='clipify-pulse/ui/playlist.webp' label='PLAYLIST · STREAM HIGHLIGHTS' className='pulse-product-frame--portrait' style={{ opacity: productIn, transform: `translate(${(1 - productIn) * 220}px, ${pan}px) rotateY(${-8 + (1 - productIn) * 10}deg) rotateZ(1.5deg) scale(${0.92 + productIn * 0.08})` }} imageStyle={{ width: "100%", transform: `translateY(${pan * 0.2}px) scale(1.025)`, transformOrigin: "top center" }} />
			<div className='pulse-floating-clip pulse-floating-clip--one' style={{ opacity: 1 - snap, transform: `translate(${snap * 260}px, ${Math.sin(local / 11) * 8 - snap * 120}px) rotate(${-6 + snap * 5}deg) scale(${1 - snap * 0.16})` }}>
				<IconGripVertical size={21} />
				<div>
					<strong>Insane double backstab</strong>
					<span>27.3s · ready to play</span>
				</div>
			</div>
			<div className='pulse-queue-confirm' style={{ opacity: snap, transform: `translateY(${(1 - snap) * 18}px) scale(${0.9 + snap * 0.1})` }}>
				<IconCheck size={19} /> CLIP ADDED TO THE LINEUP
			</div>
		</AbsoluteFill>
	);
};

const StyleScene = () => {
	const frame = useCurrentFrame();
	const local = pulseLocalFrame(frame, PULSE_SCENE_STARTS.style);
	const opacity = sceneOpacity(frame, PULSE_SCENE_STARTS.style, PULSE_SCENE_STARTS.broadcast, 9);
	const productIn = spring({ frame: local, fps: 30, config: { damping: 17, stiffness: 160, mass: 0.8 } });
	const paletteFrames = PULSE_CUE_FRAMES.paletteClicks.map((cue) => pulseLocalFrame(cue, PULSE_SCENE_STARTS.style));
	const activeSwatch = local < paletteFrames[0] ? 0 : local < paletteFrames[1] ? 1 : 2;
	return (
		<AbsoluteFill className='pulse-scene pulse-feature-scene pulse-style-scene' style={{ opacity }}>
			<AccentGlow color='#4a4595' style={{ left: "22%", top: "48%", opacity: 0.62 }} />
			<ProductFrame src='clipify-pulse/ui/theme.webp' label='THEME STUDIO · LIVE PREVIEW' className='pulse-product-frame--theme' style={{ opacity: productIn, transform: `translate(${(1 - productIn) * -210}px, -35px) rotateY(${7 - (1 - productIn) * 9}deg) rotateZ(-1.2deg) scale(${0.93 + productIn * 0.07})` }} imageStyle={{ width: "100%", transform: `translateY(${-18 - local * 0.16}px) scale(1.02)`, transformOrigin: "top center" }} />
			<div className='pulse-palette' style={{ transform: `translateY(${Math.sin(local / 14) * 8}px)` }}>
				{["#413f92", "#4a4595", "#6355a0", "#826aad"].map((color, index) => (
					<span key={color} className={index === activeSwatch ? "pulse-palette-active" : ""} style={{ background: color, transform: `scale(${index === activeSwatch ? 1.18 : 1})` }} />
				))}
			</div>
			<div className='pulse-feature-copy pulse-feature-copy--right'>
				<div className='pulse-step'>02 / MAKE IT YOURS</div>
				<WordReveal frame={local} at={4}>
					YOUR LOOK.
				</WordReveal>
				<WordReveal frame={local} at={13} className='pulse-word-accent'>
					YOUR BREAK.
				</WordReveal>
				<p>Match the clips, colors, and energy to your channel.</p>
			</div>
		</AbsoluteFill>
	);
};

const BroadcastScene = () => {
	const frame = useCurrentFrame();
	const local = pulseLocalFrame(frame, PULSE_SCENE_STARTS.broadcast);
	const opacity = sceneOpacity(frame, PULSE_SCENE_STARTS.broadcast, PULSE_SCENE_STARTS.controls, 9);
	const productIn = spring({ frame: local, fps: 30, config: { damping: 19, stiffness: 140, mass: 0.9 } });
	const camera = interpolate(local, [0, 105], [1.08, 1.02], clamp);
	return (
		<AbsoluteFill className='pulse-scene pulse-broadcast-scene' style={{ opacity }}>
			<AccentGlow color='#4a4595' style={{ left: "48%", top: "50%", opacity: 0.48 }} />
			<ProductFrame src='clipify-pulse/ui/broadcast.webp' label='LIVE OUTPUT · CLIP PLAYBACK' className='pulse-product-frame--broadcast' style={{ opacity: productIn, transform: `translateY(${(1 - productIn) * 130}px) scale(${camera})` }} imageStyle={{ width: "100%", height: "100%", objectFit: "cover" }} />
			<div className='pulse-live-pill'>
				<span /> LIVE IN OBS
			</div>
			<div className='pulse-broadcast-copy'>
				<div className='pulse-step'>03 / KEEP THE SHOW GOING</div>
				<WordReveal frame={local} at={5}>
					YOUR BEST MOMENTS.
				</WordReveal>
				<WordReveal frame={local} at={16} className='pulse-word-accent'>
					STILL LIVE.
				</WordReveal>
			</div>
		</AbsoluteFill>
	);
};

const ControlsScene = () => {
	const frame = useCurrentFrame();
	const local = pulseLocalFrame(frame, PULSE_SCENE_STARTS.controls);
	const opacity = sceneOpacity(frame, PULSE_SCENE_STARTS.controls, PULSE_SCENE_STARTS.momentum, 9);
	const productIn = spring({ frame: local, fps: 30, config: { damping: 18, stiffness: 155, mass: 0.82 } });
	const localPresses = PULSE_CUE_FRAMES.controlPresses.map((cue) => pulseLocalFrame(cue, PULSE_SCENE_STARTS.controls));
	const latestPress = [...localPresses].reverse().find((press) => local >= press);
	const click = latestPress === undefined ? 0 : spring({ frame: local - latestPress, fps: 30, config: { damping: 10, stiffness: 300, mass: 0.45 } });
	const controlState = local < localPresses[0] ? "pause" : local < localPresses[1] ? "play" : local < localPresses[2] ? "pause" : "next";
	return (
		<AbsoluteFill className='pulse-scene pulse-controls-scene' style={{ opacity }}>
			<AccentGlow color='#6355a0' style={{ left: "68%", top: "40%", opacity: 0.58 }} />
			<div className='pulse-controls-copy'>
				<div className='pulse-step'>04 / STAY IN CONTROL</div>
				<WordReveal frame={local} at={4}>
					PLAY.
				</WordReveal>
				<WordReveal frame={local} at={11}>
					PAUSE.
				</WordReveal>
				<WordReveal frame={local} at={18} className='pulse-word-accent'>
					MOVE ON.
				</WordReveal>
				<p>Run the break without breaking the flow.</p>
			</div>
			<div className='pulse-controls-stack' style={{ opacity: productIn, transform: `translateX(${(1 - productIn) * 180}px) scale(${0.94 + productIn * 0.06})` }}>
				<ProductFrame src='clipify-pulse/ui/selection.webp' label='SELECTED CLIP · LIVE PREVIEW' className='pulse-product-frame--selection' imageStyle={{ width: "100%" }} />
				<ProductFrame src='clipify-pulse/ui/controls.webp' label='PLAYBACK CONTROLS' className='pulse-product-frame--controls' imageStyle={{ width: "100%" }} />
				<div className='pulse-control-press' style={{ transform: `scale(${1 - click * 0.14})` }}>
					{controlState === "play" ? <IconPlayerPlayFilled size={28} /> : controlState === "next" ? <IconPlayerTrackNextFilled size={28} /> : <IconPlayerPauseFilled size={28} />}
				</div>
			</div>
		</AbsoluteFill>
	);
};

const MomentumScene = () => {
	const frame = useCurrentFrame();
	const local = pulseLocalFrame(frame, PULSE_SCENE_STARTS.momentum);
	const opacity = sceneOpacity(frame, PULSE_SCENE_STARTS.momentum, PULSE_SCENE_STARTS.end, 8);
	const wordStarts = PULSE_CUE_FRAMES.momentumWords.map((cue) => pulseLocalFrame(cue, PULSE_SCENE_STARTS.momentum));
	const words = [
		{ label: "PICK.", from: wordStarts[0], to: wordStarts[1] },
		{ label: "PLAY.", from: wordStarts[1], to: wordStarts[2] },
		{ label: "KEEP MOVING.", from: wordStarts[2], to: PULSE_SCENE_STARTS.end - PULSE_SCENE_STARTS.momentum },
	];
	return (
		<AbsoluteFill className='pulse-scene pulse-momentum-scene' style={{ opacity }}>
			<div className='pulse-montage pulse-montage--a' style={{ transform: `translateX(${-130 + local * 2.2}px) rotate(-5deg)` }}>
				<Img src={staticFile("clipify-pulse/ui/playlist.webp")} />
			</div>
			<div className='pulse-montage pulse-montage--b' style={{ transform: `translateX(${130 - local * 1.7}px) rotate(4deg)` }}>
				<Img src={staticFile("clipify-pulse/ui/broadcast.webp")} />
			</div>
			<div className='pulse-momentum-shade' />
			<div className='pulse-momentum-words'>
				{words.map((word) => {
					const active = local >= word.from && local < word.to;
					const progress = spring({ frame: local - word.from, fps: 30, config: { damping: 16, stiffness: 210, mass: 0.6 } });
					return (
						<div key={word.label} className={word.label === "KEEP MOVING." ? "pulse-word-accent" : ""} style={{ opacity: active ? progress : 0, transform: `translateY(${(1 - progress) * 90}px) scale(${0.9 + progress * 0.1})` }}>
							{word.label}
						</div>
					);
				})}
			</div>
			<div className='pulse-momentum-sub'>THE BREAK SCREEN THAT STAYS PART OF THE SHOW</div>
		</AbsoluteFill>
	);
};

const EndScene = () => {
	const frame = useCurrentFrame();
	const local = pulseLocalFrame(frame, PULSE_SCENE_STARTS.end);
	const opacity = interpolate(frame, [PULSE_SCENE_STARTS.end - 9, PULSE_SCENE_STARTS.end, CLIPIFY_PULSE_DURATION_IN_FRAMES - 1], [0, 1, 1], clamp);
	const settle = spring({ frame: local, fps: 30, config: { damping: 18, stiffness: 135, mass: 0.9 } });
	const cta = spring({ frame: frame - PULSE_CUE_FRAMES.endCta, fps: 30, config: { damping: 17, stiffness: 170, mass: 0.72 } });
	return (
		<AbsoluteFill className='pulse-scene pulse-end-scene' style={{ opacity }}>
			<AccentGlow color='#6355a0' style={{ left: "50%", top: "44%", opacity: 0.74, transform: `translate(-50%, -50%) scale(${1 + Math.sin(local / 26) * 0.04})` }} />
			<div className='pulse-end-ring pulse-end-ring--one' style={{ transform: `translate(-50%, -50%) rotate(${local * 0.28}deg) scale(${0.7 + settle * 0.3})` }} />
			<div className='pulse-end-ring pulse-end-ring--two' style={{ transform: `translate(-50%, -50%) rotate(${-local * 0.22}deg) scale(${0.72 + settle * 0.28})` }} />
			<div className='pulse-end-content' style={{ opacity: settle, transform: `translateY(${(1 - settle) * 50}px) scale(${0.88 + settle * 0.12})` }}>
				<div className='pulse-end-logo'>
					<LogoMark size={102} />
				</div>
				<div className='pulse-end-wordmark'>CLIPIFY</div>
				<div className='pulse-end-title'>TAKE THE BREAK. KEEP THE MOMENTUM.</div>
				<div className='pulse-end-cta' style={{ opacity: cta, transform: `translateY(${(1 - cta) * 18}px) scale(${0.92 + cta * 0.08})` }}>
					<IconBrandTwitch size={28} />
					<span>START FREE WITH TWITCH</span>
					<IconArrowUpRight size={26} />
				</div>
				<div className='pulse-end-url' style={{ opacity: cta }}>
					CLIPIFY.US
				</div>
			</div>
			<div className='pulse-end-spark pulse-end-spark--a'>
				<IconSparkles size={34} />
			</div>
			<div className='pulse-end-spark pulse-end-spark--b'>
				<IconSparkles size={26} />
			</div>
		</AbsoluteFill>
	);
};

export const ClipifyPulse = () => {
	const frame = useCurrentFrame();
	const { durationInFrames } = useVideoConfig();
	const ambientScale = 1 + Math.sin(frame / 48) * 0.0035;
	return (
		<AbsoluteFill className='pulse-root' style={{ transform: `scale(${ambientScale})` }}>
			<div className='pulse-background' />
			<OpeningScene />
			<PlaylistScene />
			<StyleScene />
			<BroadcastScene />
			<ControlsScene />
			<MomentumScene />
			<EndScene />
			<Chrome />
			<div className='pulse-progress' style={{ transform: `scaleX(${frame / Math.max(1, durationInFrames - 1)})` }} />
			<Html5Audio src={staticFile("clipify-pulse/audio/clipify-pulse-original.wav")} />
		</AbsoluteFill>
	);
};
