import { AbsoluteFill, Html5Audio, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig, delayRender, continueRender, cancelRender } from "remotion";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { IconCheck, IconDownload, IconPlayerPlayFilled, IconPointerFilled } from "@tabler/icons-react";
import { T } from "./timeline";
import { flowLayout, type Box, type FlowFormat } from "./layout";
import "./styles.css";

const file = (name: string) => staticFile(`clipify-flow/${name}`);
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const p = (f: number, a: number, b: number) => {
	const q = clamp((f - a) / (b - a));
	return q * q * (3 - 2 * q);
};
const mix = (a: number, b: number, q: number) => a + (b - a) * q;
const blend = (a: Box, b: Box, q: number): Box => ({ x: mix(a.x, b.x, q), y: mix(a.y, b.y, q), w: mix(a.w, b.w, q), h: mix(a.h, b.h, q) });
const cssBox = (b: Box): CSSProperties => ({ left: b.x, top: b.y, width: b.w, height: b.h });
const CAMERA_CROP: Box = { x: 1044, y: 32, w: 224, h: 126 };

let fontPromise: Promise<void> | undefined;
const useFonts = () => {
	const [handle] = useState(() => delayRender("Loading local trailer fonts"));
	useEffect(() => {
		fontPromise ??= Promise.all([new FontFace("FlowInter", `url(${file("fonts/Inter.ttf")})`, { weight: "100 900" }).load(), new FontFace("FlowSerif", `url(${file("fonts/Serif-Regular.ttf")})`, { weight: "400" }).load(), new FontFace("FlowMono", `url(${file("fonts/Mono-Regular.ttf")})`, { weight: "400" }).load()]).then((fonts) => {
			fonts.forEach((font) => document.fonts.add(font));
		});
		fontPromise.then(() => continueRender(handle)).catch(cancelRender);
	}, [handle]);
};
const Mark = ({ height = 44 }: { height?: number }) => <Img src={file("media/clipify-logo.svg")} style={{ height, width: (height * 134.4) / 158 }} />;
const Brand = ({ large = false }: { large?: boolean }) => (
	<div className={`cf-brand ${large ? "cf-brand-large" : ""}`}>
		<Mark height={large ? 72 : 43} />
		<b>Clipify</b>
	</div>
);

// Each letter has its own transform/blur/settling; supporting lines get separate starts.
const Letters = ({ text, at, f, className = "", style = {} }: { text: string; at: number; f: number; className?: string; style?: CSSProperties }) => (
	<span className={`cf-letters ${className}`} style={style}>
		{[...text].map((c, i) => {
			const q = 1 - (1 - clamp((f - at - i * 0.85) / 11)) ** 3;
			return (
				<span key={i} style={{ opacity: clamp(q * 2), transform: `perspective(500px) translate3d(${(1 - q) * 12}px,${(1 - q) * 52}px,0) rotateX(${(1 - q) * 78}deg)`, filter: `blur(${(1 - q) * 7}px)` }}>
					{c === " " ? "\u00a0" : c}
				</span>
			);
		})}
	</span>
);
const Heading = ({ f, at, leave, eyebrow, children, style = {} }: { f: number; at: number; leave?: number; eyebrow: string; children: ReactNode; style?: CSSProperties }) => {
	const exit = leave === undefined ? 0 : p(f, leave - 12, leave);
	if (f < at || exit === 1) return null;
	return (
		<div className='cf-heading' style={{ ...style, transform: `translateX(${-(exit ** 3) * 2100}px)`, filter: `blur(${exit * 15}px)` }}>
			<div className='cf-eyebrow' style={{ opacity: p(f, at, at + 8) }}>
				{eyebrow}
			</div>
			{children}
		</div>
	);
};
const Pointer = ({ f, points, press, until }: { f: number; points: { at: number; x: number; y: number }[]; press: number; until: number }) => {
	if (f < points[0].at || f > until) return null;
	const x = interpolate(
		f,
		points.map((k) => k.at),
		points.map((k) => k.x),
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);
	const y = interpolate(
		f,
		points.map((k) => k.at),
		points.map((k) => k.y),
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);
	const ring = p(f, press, press + 12);
	return (
		<div className='cf-pointer' style={{ left: x, top: y, opacity: 1 - p(f, until - 5, until), transform: `scale(${f >= press && f < press + 4 ? 0.8 : 1})` }}>
			<IconPointerFilled size={32} />
			{f >= press && f < press + 12 && <i style={{ transform: `translate(-50%,-50%) scale(${1 + ring * 2.3})`, opacity: 1 - ring }} />}
		</div>
	);
};

const Backstab = ({ region }: { region?: Box }) => <OffthreadVideo src={file("media/backstab-source.mp4")} startFrom={210} muted style={region ? { position: "absolute", width: `${(1280 / region.w) * 100}%`, height: "auto", aspectRatio: "16 / 9", left: `${(-region.x / region.w) * 100}%`, top: `${(-region.y / region.h) * 100}%`, maxWidth: "none" } : { width: "100%", height: "auto", aspectRatio: "16 / 9", objectFit: "contain" }} />;
const Minecraft = () => <OffthreadVideo src={file("media/minecraft-source.mp4")} muted style={{ width: "100%", height: "auto", aspectRatio: "16 / 9", objectFit: "contain" }} />;

const looks = [
	{ bg: "#11121ddd", fg: "#f9f7ff", accent: "#b99aff", font: "FlowInter", weight: 550, label: "Minimal · Inter", radius: 14 },
	{ bg: "#fff3e8f5", fg: "#3b2a27", accent: "#e99676", font: "FlowSerif", weight: 400, label: "Editorial · Serif", radius: 10 },
	{ bg: "#102b25ed", fg: "#d5ffed", accent: "#6ce9b5", font: "FlowMono", weight: 400, label: "Mint · Mono", radius: 14 },
];
const lookIndex = (f: number) => (f < T.looks[0] ? 0 : f < T.looks[1] ? 1 : 2);
const Metadata = ({ theme = looks[0], kind = "channel", compact = false, game = "Minecraft" }: { theme?: (typeof looks)[number]; kind?: "channel" | "clip"; compact?: boolean; game?: "Minecraft" | "Counter-Strike" }) => (
	<div className={`cf-metadata cf-metadata-${kind} ${compact ? "is-compact" : ""}`} style={{ background: theme.bg, color: theme.fg, fontFamily: theme.font, borderRadius: theme.radius, "--metadata-accent": theme.accent, "--metadata-weight": theme.weight } as CSSProperties}>
		{kind === "channel" ? (
			<>
				<Img className='cf-channel-avatar' src={file("media/channel-avatar.jpg")} />
				<div>
					<b>thedannicraft</b>
					<span>Playing {game}</span>
				</div>
			</>
		) : (
			<div>
				<b>{game === "Minecraft" ? "GG Danni spielt OP Move" : "Insane double backstab knife"}</b>
				<span>clipped by {game === "Minecraft" ? "yummidonut" : "richieboooy"}</span>
			</div>
		)}
	</div>
);
const Widget = ({ f }: { f: number }) => {
	const current = looks[lookIndex(f)],
		q = p(f, T.drag, T.drop),
		close = p(f, T.close, T.closeLand);
	const x = mix(45, 760, q),
		y = mix(520, 92, q);
	return (
		<>
			{f >= T.grab && f < T.drop && (
				<>
					<div className='cf-guide cf-guide-x' style={{ left: 760, opacity: p(f, 590, 596) }} />
					<div className='cf-guide cf-guide-y' style={{ top: 92, opacity: p(f, 590, 596) }} />
				</>
			)}
			<div className='cf-widget' style={{ left: x, top: y, transform: `scale(${1 - close * 0.12})`, transformOrigin: "top left" }}>
				<Metadata theme={current} />
				{f >= T.grab && f < T.drop + 6 && (
					<div className='cf-widget-handles' style={{ borderColor: current.accent }}>
						{[0, 1, 2, 3].map((n) => (
							<i key={n} />
						))}
					</div>
				)}
			</div>
			<div className='cf-clip-widget' style={{ opacity: 1 - p(f, T.close, T.closeLand) }}>
				<Metadata theme={current} kind='clip' />
			</div>
			<div className='cf-live-progress' style={{ background: current.accent, width: `${clamp((f - T.stream) / (T.endHold - T.stream)) * 100}%` }} />
		</>
	);
};

export const ClipifyFlow = ({ format = "landscape" }: { format?: FlowFormat }) => {
	const f = useCurrentFrame();
	const { width } = useVideoConfig();
	// One width-derived length for BOTH axes; never size Y from frame height.
	const gridScale = width / 1080;
	useFonts();
	const social = format !== "landscape",
		vertical = format === "vertical";
	const layout = flowLayout(format);
	const { intro: INTRO, moment: MOMENT, source: SOURCE, stream: STREAM, queue: QUEUE, custom: CUSTOM, end: END, portrait: PORTRAIT } = layout;
	const CAMERA_OUTPUT: Box = { ...PORTRAIT, h: (PORTRAIT.w * 9) / 16 };
	const GAME_OUTPUT: Box = { ...PORTRAIT, y: PORTRAIT.y + CAMERA_OUTPUT.h, h: PORTRAIT.h - CAMERA_OUTPUT.h };
	const gameWidth = (720 * GAME_OUTPUT.w) / GAME_OUTPUT.h;
	const GAME_CROP: Box = { x: 640 - gameWidth / 2, y: 0, w: gameWidth, h: 720 };
	const onSource = (crop: Box): Box => ({ x: SOURCE.x + (crop.x * SOURCE.w) / 1280, y: SOURCE.y + (crop.y * SOURCE.h) / 720, w: (crop.w * SOURCE.w) / 1280, h: (crop.h * SOURCE.h) / 720 });
	const SELECTED = onSource(GAME_CROP),
		CAMERA_SELECTED = onSource(CAMERA_CROP);
	const heading = (x: number, y: number): CSSProperties => (social ? { left: layout.heading.x, top: layout.heading.y } : { left: x, top: y });
	const templatePoint = (i: number) => (social ? { x: layout.template.x + (i + 1) * 306 + 140, y: layout.template.y + 90 } : { x: 1640, y: 610 + i * 140 });
	const widgetScale = CUSTOM.w / 1180;
	const automaticEnter = p(f, T.stream, T.stream + 12);
	let hero = blend(INTRO, MOMENT, p(f, T.overview, T.overview + 24));
	hero = blend(hero, SOURCE, p(f, T.open, T.sourceReady));
	hero = blend(hero, STREAM, p(f, T.toStream, T.stream));
	if (f >= T.next) hero = { ...hero, x: hero.x - p(f, T.next, T.nextLand) * 1800 };
	// Leave the card through its preview slot, then expand clear of its text.
	const docked = social ? { ...QUEUE, y: STREAM.y + STREAM.h - QUEUE.h } : { ...QUEUE, x: STREAM.x + STREAM.w - QUEUE.w };
	let mc = f < T.nextLift ? blend(QUEUE, docked, p(f, T.next, T.nextLift)) : blend(docked, STREAM, p(f, T.nextLift, T.nextLand));
	if (f < T.next) mc = { ...mc, y: mc.y + (1 - automaticEnter) * 60 };
	mc = blend(mc, CUSTOM, p(f, T.custom, T.custom + 24));
	mc = blend(mc, END, p(f, T.close, T.closeLand));
	const lift = p(f, T.lift, T.land),
		draw = p(f, T.draw, T.gameDrawEnd),
		cameraDraw = p(f, T.cameraDraw, T.drawEnd);
	const toStream = p(f, T.toStream, T.stream),
		custom = lookIndex(f),
		ending = p(f, T.close, T.closeLand);
	const exitOverview = p(f, T.open, T.open + 24);
	const sourceMask = p(f, T.draw, T.gameDrawEnd) * (1 - p(f, 282, T.toStream));
	const endReveal = p(f, T.endReveal, T.endHold);
	const renderOverview = () => (
		<>
			<Heading f={f} at={0} leave={T.overview} eyebrow='YOUR TWITCH HIGHLIGHTS' style={{ left: layout.introHeading.x, top: layout.introHeading.y }}>
				<h1>
					<Letters f={f} at={0} text='Stream' />
					{format === "feed" ? " " : <br />}
					<Letters f={f} at={12} text='over?' />
				</h1>
				<div className='cf-intro-answer'>
					<Letters f={f} at={T.promise} text='Keep it alive.' />
				</div>
			</Heading>
			<Heading f={f} at={T.overview + 10} leave={T.open + 18} eyebrow='STREAM OVERVIEW' style={heading(110, 155)}>
				<h1 className='cf-heading-wide'>
					<Letters f={f} at={T.overview + 10} text='Your best moments.' />
				</h1>
				<p style={{ opacity: p(f, 100, 112) }}>Revisit what made your stream.</p>
			</Heading>
			{f >= T.overview && f < T.open + 24 && (
				<div className='cf-moments-context' style={{ opacity: p(f, 80, 92) * (1 - exitOverview), transform: `translateX(${-(exitOverview ** 2) * 1800}px)` }}>
					<div className='cf-stream-track'>
						<i />
						<i />
					</div>
					<span className='cf-track-start'>STREAM START</span>
					<span className='cf-track-end'>STREAM END</span>
					<div className='cf-other-moment' style={social ? cssBox(layout.other) : undefined}>
						<Sequence from={T.overview} durationInFrames={T.open + 24 - T.overview} layout='none'>
							<Minecraft />
						</Sequence>
						<div>
							<b>GG Danni spielt OP Move</b>
							<span>MINECRAFT</span>
						</div>
					</div>
				</div>
			)}
		</>
	);
	const renderSourcePlayer = () => (
		<>
			{/* This one source node stays mounted from the hook through export into playback. */}
			{f < T.nextLand && (
				<div className={`cf-hero ${f >= T.select && f < T.open ? "cf-selected" : ""}`} style={{ ...cssBox(hero), borderRadius: mix(22, 12, p(f, T.open, T.sourceReady)), boxShadow: f >= T.select && f < T.open ? "0 0 0 5px #ffffff77,0 25px 100px #22004b88" : undefined }}>
					<Backstab />
					{f < T.open && (
						<div className='cf-video-title'>
							<span>COUNTER-STRIKE</span>
							<b>Insane double backstab knife</b>
							<small>thedannicraft · clipped by richieboooy</small>
						</div>
					)}
					{f >= T.toStream && (
						<>
							<div className='cf-basic-widget' style={{ opacity: toStream, ...(social ? { transform: `scale(${hero.w / 1180})`, transformOrigin: "left bottom" } : {}) }}>
								<Metadata game='Counter-Strike' />
							</div>
							<div className='cf-basic-clip' style={{ opacity: toStream, ...(social ? { transform: `scale(${hero.w / 1180})`, transformOrigin: "right bottom" } : {}) }}>
								<Metadata game='Counter-Strike' kind='clip' />
							</div>
							<div className='cf-live-progress' style={{ width: `${p(f, T.stream, T.next) * 100}%` }} />
						</>
					)}
					{sourceMask > 0 && (
						<svg className='cf-source-shade' viewBox='0 0 1280 720' preserveAspectRatio='none' style={{ opacity: sourceMask }}>
							<defs>
								<mask id='cf-source-crops'>
									<rect width='1280' height='720' fill='white' />
									<rect x={GAME_CROP.x} y={GAME_CROP.y} width={GAME_CROP.w * draw} height={GAME_CROP.h * draw} fill='black' />
									<rect x={CAMERA_CROP.x} y={CAMERA_CROP.y} width={CAMERA_CROP.w * cameraDraw} height={CAMERA_CROP.h * cameraDraw} fill='black' />
								</mask>
							</defs>
							<rect width='1280' height='720' fill='#090611' fillOpacity='.65' mask='url(#cf-source-crops)' />
						</svg>
					)}
				</div>
			)}
			<Pointer
				f={f}
				press={T.select}
				until={T.open}
				points={[
					{ at: 116, x: social ? MOMENT.x + MOMENT.w + 40 : 1830, y: social ? MOMENT.y + MOMENT.h : 890 },
					{ at: 128, x: social ? MOMENT.x + MOMENT.w * 0.56 : 1415, y: social ? MOMENT.y + MOMENT.h * 0.53 : 640 },
					{ at: T.select, x: social ? MOMENT.x + MOMENT.w * 0.56 : 1415, y: social ? MOMENT.y + MOMENT.h * 0.53 : 640 },
				]}
			/>
		</>
	);
	const renderCropSelections = () => (
		<>
			<Heading f={f} at={T.open + 22} leave={T.toStream} eyebrow='CLIP EXPORT · MOBILE' style={heading(110, 140)}>
				<h1 className='cf-heading-wide'>
					{vertical ? (
						<>
							<Letters f={f} at={T.open + 22} text='Reframe.' />
							<br />
							<Letters f={f} at={T.open + 22 + 7.65} text='Export. Share.' />
						</>
					) : (
						<Letters f={f} at={T.open + 22} text='Reframe. Export. Share.' />
					)}
				</h1>
				<p style={{ opacity: p(f, 188, 200) }}>The same moment. A whole new format.</p>
			</Heading>
			{f >= T.draw && f < T.toStream && (
				<>
					<div className='cf-source-selection' style={{ left: SELECTED.x, top: SELECTED.y, width: SELECTED.w * draw, height: SELECTED.h * draw, opacity: 1 - p(f, 282, T.toStream) }}>
						{draw > 0.98 && (
							<>
								<span>GAMEPLAY</span>
								{[0, 1, 2, 3].map((n) => (
									<i key={n} />
								))}
							</>
						)}
					</div>
					{f >= T.cameraDraw && (
						<div className='cf-source-selection cf-camera-selection' style={{ ...cssBox(CAMERA_SELECTED), width: CAMERA_SELECTED.w * cameraDraw, height: CAMERA_SELECTED.h * cameraDraw, opacity: 1 - p(f, 282, T.toStream) }}>
							{cameraDraw > 0.98 && (
								<>
									<span>CAMERA</span>
									{[0, 1, 2, 3].map((n) => (
										<i key={n} />
									))}
								</>
							)}
						</div>
					)}
				</>
			)}
		</>
	);
	const renderCropTransfer = () => (
		<>
			{f >= T.lift && f < T.stream && (
				<>
					<div className='cf-phone-backdrop' style={{ ...cssBox({ ...PORTRAIT, x: PORTRAIT.x + toStream ** 2 * 1000 }), opacity: p(f, T.land - 4, T.land) * (1 - toStream) }} />
					{[
						{ source: CAMERA_SELECTED, target: CAMERA_OUTPUT, crop: CAMERA_CROP, camera: true },
						{ source: SELECTED, target: GAME_OUTPUT, crop: GAME_CROP, camera: false },
					].map((part) => {
						const box = blend(part.source, part.target, lift);
						return (
							<div key={part.camera ? "camera" : "game"} className='cf-crop-travel' style={{ ...cssBox({ ...box, x: box.x + toStream ** 2 * 1000 }), borderRadius: part.camera ? `${lift * 16}px ${lift * 16}px 0 0` : `0 0 ${lift * 16}px ${lift * 16}px`, opacity: 1 - toStream, boxShadow: `0 20px ${lift * 40}px #20004322` }}>
								<Backstab region={part.crop} />
								{!part.camera && lift > 0.99 && (
									<div className='cf-portrait-mark'>
										<Mark height={19} />
										<span>Clipify</span>
									</div>
								)}
							</div>
						);
					})}
				</>
			)}
		</>
	);
	const renderExportControls = () => (
		<>
			<Pointer
				f={f}
				press={T.draw}
				until={T.gameDrawEnd + 2}
				points={[
					{ at: 194, x: SELECTED.x - 60, y: SELECTED.y - 40 },
					{ at: T.draw, x: SELECTED.x, y: SELECTED.y },
					{ at: T.gameDrawEnd, x: SELECTED.x + SELECTED.w, y: SELECTED.y + SELECTED.h },
				]}
			/>
			<Pointer
				f={f}
				press={T.cameraDraw}
				until={T.lift}
				points={[
					{ at: T.gameDrawEnd + 2, x: CAMERA_SELECTED.x - 15, y: CAMERA_SELECTED.y - 15 },
					{ at: T.cameraDraw, x: CAMERA_SELECTED.x, y: CAMERA_SELECTED.y },
					{ at: T.drawEnd, x: CAMERA_SELECTED.x + CAMERA_SELECTED.w, y: CAMERA_SELECTED.y + CAMERA_SELECTED.h },
				]}
			/>
			{f >= T.land && f < T.stream && (
				<div className='cf-export-result' style={{ ...(social ? { left: layout.exportButton.x, top: layout.exportButton.y, width: vertical ? 394 : 358 } : {}), transform: `translateX(${toStream ** 2 * 1000}px)`, filter: `blur(${toStream * 12}px)`, opacity: 1 - toStream }}>
					<div className={`cf-export-button ${f >= T.ready ? "is-ready" : ""}`} style={{ transform: `scale(${f >= T.export && f < T.export + 5 ? 0.95 : 1})` }}>
						{f >= T.ready ? <IconCheck size={27} /> : <IconDownload size={27} />}
						<b>{f >= T.ready ? "Mobile.mp4" : "Export clip"}</b>
						<span>{f >= T.ready ? "READY TO SHARE" : "9:16"}</span>
					</div>
				</div>
			)}
			<Pointer
				f={f}
				press={T.export}
				until={T.ready}
				points={[
					{ at: 254, x: social ? layout.exportButton.x + 350 : 1825, y: social ? layout.exportButton.y - 32 : 950 },
					{ at: 262, x: social ? layout.exportButton.x + 176 : 1550, y: social ? layout.exportButton.y + 28 : 1010 },
					{ at: T.export, x: social ? layout.exportButton.x + 176 : 1550, y: social ? layout.exportButton.y + 28 : 1010 },
				]}
			/>
		</>
	);
	const renderPlayback = () => (
		<>
			<Heading f={f} at={T.toStream + 17} leave={T.custom} eyebrow='ON YOUR NEXT STREAM · OBS BROWSER SOURCE' style={heading(110, 135)}>
				<h1 className='cf-heading-wide'>
					<Letters f={f} at={T.toStream + 17} text='Take a break.' />
					{vertical && <br />}
					<Letters f={f} at={T.stream + 2} text=' They’ll play.' />
				</h1>
			</Heading>
			{f >= T.stream && f < T.custom + 24 && (
				<div className='cf-auto-panel' style={{ ...cssBox(layout.autoPanel.box), padding: layout.autoPanel.inset - 1, "--queue-left": `${QUEUE.x - layout.autoPanel.box.x - 1}px`, "--queue-width": `${QUEUE.w}px`, opacity: automaticEnter * (1 - p(f, T.custom, T.custom + 24)), transform: `translateY(${(1 - automaticEnter) * 60 + p(f, T.custom, T.custom + 24) * 450}px)` } as CSSProperties}>
					<span>AUTOMATIC SELECTION</span>
					<h2>Your Twitch clips</h2>
					<div className='cf-auto-filters'>
						<div>
							Min. views<b>10+</b>
						</div>
						<div>
							Max. length<b>60 sec</b>
						</div>
					</div>
					<div className='cf-auto-rule' />
					<b className='cf-up-next' style={{ opacity: f < T.next ? 1 - p(f, T.next - 4, T.next) : p(f, T.nextLand, T.nextLand + 6) }}>
						{f < T.next ? "Up next" : "Now playing"}
					</b>
					<small style={{ opacity: f < T.next ? 1 - p(f, T.next - 4, T.next) : p(f, T.nextLand, T.nextLand + 6) }}>{f < T.next ? "GG Danni spielt OP Move" : "Your next moment, automatically."}</small>
				</div>
			)}

			{/* One Minecraft node: queue preview -> live player -> theme canvas -> close. */}
			{f >= T.stream && (
				<Sequence from={T.stream} layout='none'>
					<div className='cf-minecraft-player' style={{ ...cssBox(mc), borderRadius: mix(12, 20, ending), opacity: f < T.next ? automaticEnter : 1, outlineWidth: f < T.next ? 1 : undefined, boxShadow: f < T.next ? "0 8px 20px #0004" : undefined }}>
						<Minecraft />
						{f < T.next && (
							<span className='cf-queue-play'>
								<IconPlayerPlayFilled size={23} />
							</span>
						)}
						{f >= T.next && (
							<div style={{ position: "absolute", inset: 0, opacity: p(f, T.next, T.nextLand), transform: `scale(${mc.w / 1180})`, transformOrigin: "top left", width: 1180, height: 663.75 }}>
								<Widget f={f} />
							</div>
						)}
					</div>
				</Sequence>
			)}
			{f >= T.nextLand && f < T.custom && (
				<div className='cf-next-confirm' style={{ opacity: p(f, T.nextLand, T.nextLand + 8) }}>
					<IconCheck size={26} /> Next clip, already playing.
				</div>
			)}
		</>
	);
	const renderCustomization = () => (
		<>
			<Heading f={f} at={T.custom + 12} leave={T.close} eyebrow='THEME STUDIO · PRO' style={heading(110, 135)}>
				<h1 className='cf-heading-wide'>
					{vertical ? (
						<>
							<Letters f={f} at={T.custom + 12} text='Your channel.' />
							<br />
							<Letters f={f} at={T.custom + 23.05} text='Your rules.' />
						</>
					) : (
						<Letters f={f} at={T.custom + 12} text='Your channel. Your rules.' />
					)}
				</h1>
			</Heading>
			{f >= T.custom && f < T.closeLand && (
				<div className='cf-theme-controls' style={{ opacity: p(f, T.custom + 24, T.custom + 36) * (1 - p(f, T.close, T.close + 12)), transform: `translateX(${p(f, T.close, T.close + 12) ** 2 * 950}px)` }}>
					<span>MAKE IT YOURS</span>
					{looks.map((l, i) => (
						<div key={l.label} className={i === custom ? "is-active" : ""}>
							<Metadata theme={l} compact />
							<div className='cf-template-label'>
								<span>{l.label}</span>
								{i === custom && <IconCheck size={18} />}
							</div>
						</div>
					))}
					<p className='cf-theme-properties'>
						<span>Color</span>
						<span>Type</span>
						<span>Position</span>
					</p>
					<div className='cf-drag-hint'>{f < T.grab ? "Make your moment recognizable." : f < T.drop ? "Place it where it belongs." : "Your layout. Locked in."}</div>
				</div>
			)}
			{T.looks.map((at, i) => (
				<Pointer
					key={at}
					f={f}
					press={at}
					until={at + 12}
					points={[
						{ at: at - 12, x: social ? 990 : 1830, y: social ? layout.template.y - 20 : 450 + i * 140 },
						{ at: at - 2, ...templatePoint(i) },
						{ at, ...templatePoint(i) },
					]}
				/>
			))}
			<Pointer
				f={f}
				press={T.grab}
				until={T.drop + 12}
				points={[
					{ at: 552, x: social ? 500 : 560, y: social ? CUSTOM.y + CUSTOM.h : 940 },
					{ at: T.grab, x: CUSTOM.x + (45 + 165) * widgetScale, y: CUSTOM.y + (520 + 42) * widgetScale },
					{ at: T.drag, x: CUSTOM.x + (45 + 165) * widgetScale, y: CUSTOM.y + (520 + 42) * widgetScale },
					...Array.from({ length: 9 }, (_, i) => {
						const at = T.drag + i * 3,
							q = p(at, T.drag, T.drop);
						return { at: at + 0.01, x: CUSTOM.x + (mix(45, 760, q) + 165) * widgetScale, y: CUSTOM.y + (mix(520, 92, q) + 42) * widgetScale };
					}),
				]}
			/>
		</>
	);
	return (
		<AbsoluteFill className={`cf-root cf-${format}`} style={{ "--grid-cell": `${48 * gridScale}px`, "--grid-stroke": `${gridScale}px`, "--grid-offset": `${24 * gridScale}px` } as CSSProperties}>
			<div className='cf-color-field' />
			<div className='cf-grid' />
			<div className='cf-corner-glow' />
			{f < T.endHold && (
				<div className='cf-product-layer' style={{ opacity: 1 - p(f, T.endStart, T.endContentOut) }}>
					<div className='cf-corner-brand' style={{ top: social ? (vertical ? 140 : 60) : mix(60, 100, ending), zIndex: 30 }}>
						<div style={{ transform: `scale(${mix(1, social ? 1.35 : 1.68, ending)})`, transformOrigin: "left top" }}>
							<Brand />
						</div>
						<span style={{ opacity: 1 - ending }}>KEEP YOUR STREAM ALIVE</span>
					</div>

					{renderOverview()}
					{renderSourcePlayer()}
					{renderCropSelections()}
					{renderCropTransfer()}
					{renderExportControls()}
					{renderPlayback()}
					{renderCustomization()}
					{f >= T.close && (
						<div className='cf-ending-copy' style={{ opacity: p(f, T.close, T.close + 10) }}>
							<h1>
								<Letters text='Let your' f={f} at={T.close + 28} />
								<br />
								<Letters text='clips talk.' f={f} at={T.close + 41} />
							</h1>
							<div className='cf-end-sub'>
								<Letters text='Even when you can’t.' f={f} at={T.close + 58} />
							</div>
							<div className='cf-final-cta' style={{ opacity: p(f, T.cta, T.cta + 12), transform: `translateY(${(1 - p(f, T.cta, T.cta + 12)) * 30}px)` }}>
								<span>Get started for free at</span>
								<b>clipify.us</b>
							</div>
						</div>
					)}
					{f >= T.close && (
						<div className='cf-closing-caption' style={{ opacity: ending }}>
							<b>Your Twitch highlights, on stream.</b>
							<span>Your moments keep working.</span>
						</div>
					)}
				</div>
			)}
			{f >= T.endStart && (
				<div className='cf-end-screen' style={{ opacity: endReveal }}>
					<div style={{ transform: `scale(${mix(0.96, 1, endReveal)})` }}>
						<Brand large />
					</div>
					<h1>
						<Letters text='Keep your' f={f} at={T.endStart} />
						{social ? <br /> : " "}
						<Letters text='stream alive.' f={f} at={T.endStart} />
					</h1>
					<div className='cf-end-screen-cta' style={{ opacity: p(f, T.endStart + 8, T.endHold) }}>
						<span>Get started for free at</span>
						<b>clipify.us</b>
					</div>
				</div>
			)}
			<Html5Audio src={file("audio/mix.wav")} />
		</AbsoluteFill>
	);
};
