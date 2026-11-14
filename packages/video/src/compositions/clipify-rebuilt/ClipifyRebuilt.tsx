import { AbsoluteFill, Html5Audio, Img, Easing, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import type { CSSProperties, ReactNode } from "react";
import { IconArrowUpRight, IconCheck, IconDownload, IconPlayerPlayFilled, IconBrandTwitch, IconPalette } from "@tabler/icons-react";
import { ACTION as A, SHOTS as S } from "./timeline";
import "./styles.css";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const ease = Easing.bezier(0.65, 0, 0.2, 1);
const progress = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: ease });
const linear = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);
const land = (f: number, at: number) => spring({ frame: f - at, fps: 30, config: { damping: 21, stiffness: 230, mass: 0.65 } });
const asset = (name: string) => staticFile(`clipify-rebuilt/${name}`);
const clips = [
	{ title: "lol", game: "MINECRAFT", stamp: "00:18:42", kind: 1 },
	{ title: "Insane double backstab", game: "COUNTER-STRIKE", stamp: "02:14:08", kind: 0 },
	{ title: "lol", game: "MINECRAFT", stamp: "03:28:51", kind: 1 },
];
const Logo = ({ height = 46 }: { height?: number }) => <Img src={asset("media/clipify-logo.svg")} style={{ height, width: (height * 134.4) / 158 }} />;
const Brand = () => (
	<div className='hr-brand'>
		<Logo height={42} />
		<b>clipify</b>
	</div>
);
const Pro = () => <span className='hr-pro'>PRO</span>;

// Repository-owned website captures replace the audition's cartoon media.
// Their pixels are not claimed as moving footage; UI, crops, queue and styling are animated.
const Clip = ({ kind = 0, role = "full", f = 0 }: { kind?: number; role?: "full" | "camera" | "game" | "source"; f?: number }) => {
	const file = kind === 0 ? "counter-strike.webp" : "minecraft.png";
	const crop = role === "camera" && kind === 0 ? { x: 1355, y: 47, w: 295, h: 160, iw: 1664, ih: 936 } : role === "game" && kind === 0 ? { x: 480, y: 130, w: 650, h: 750, iw: 1664, ih: 936 } : role === "full" && kind === 0 ? { x: 0, y: 98, w: 1345, h: 757, iw: 1664, ih: 936 } : kind === 1 ? { x: 5, y: 125, w: 1535, h: 864, iw: 1920, ih: 1080 } : null;
	const style: CSSProperties = crop ? { position: "absolute", width: `${(crop.iw / crop.w) * 100}%`, height: `${(crop.ih / crop.h) * 100}%`, left: `${(-crop.x / crop.w) * 100}%`, top: `${(-crop.y / crop.h) * 100}%`, maxWidth: "none" } : { width: "100%", height: "100%", objectFit: "cover" };
	return (
		<div className='hr-clip'>
			<Img src={asset(`media/${file}`)} style={{ ...style, filter: "saturate(.88) contrast(1.03)", transform: role === "full" ? `scale(${1.015 + Math.sin(f / 100) * 0.008})` : undefined }} />
		</div>
	);
};
const Head = ({ eyebrow, children, at = 0, f, side = false }: { eyebrow: string; children: ReactNode; at?: number; f: number; side?: boolean }) => (
	<div className={`hr-head ${side ? "hr-head-side" : ""}`} style={{ transform: `translateY(${(1 - land(f, at)) * 25}px)`, opacity: land(f, at) }}>
		<span>{eyebrow}</span>
		<h1>{children}</h1>
	</div>
);
const Touch = ({ x, y, f, at }: { x: number; y: number; f: number; at: number }) => {
	const q = linear(f, at, at + 12);
	return f < at - 8 || f > at + 12 ? null : <div className='hr-touch' style={{ left: x, top: y, transform: `translate(-50%,-50%) scale(${f < at ? 1 : 1 + q * 1.8})`, opacity: f < at ? 0.65 : 1 - q }} />;
};
const Stamp = ({ children }: { children: ReactNode }) => <div className='hr-stamp'>{children}</div>;

const MomentSequence = ({ f }: { f: number }) => {
	const lift = progress(f, A.lift, S.export);
	const bgExit = progress(f, 72, 90);
	return (
		<>
			<div style={{ transform: `translateX(${-bgExit * 210}px)`, opacity: 1 - bgExit }}>
				<Head f={f} eyebrow='STREAM OVERVIEW · LAST BROADCAST'>
					YOUR LAST <em>STREAM.</em>
				</Head>
				<div className='hr-stream-summary'>
					<b>One more game.</b>
					<span>
						03:42:18 <small>STREAM LENGTH</small>
					</span>
				</div>
				<div className='hr-timeline-line' />
				<div className='hr-timeline-end hr-timeline-start'>STREAM START</div>
				<div className='hr-timeline-end hr-timeline-stop'>STREAM END</div>
				{clips.map((clip, i) => {
					const q = land(f, A.cards[i]);
					return (
						<div className={`hr-moment ${i === 1 && f >= A.select ? "hr-moment-selected" : ""}`} key={i} style={{ left: 150 + i * 550, opacity: i === 1 && f >= 72 ? 0 : q, transform: `translateY(${(1 - q) * 60}px)` }}>
							<Stamp>{clip.stamp}</Stamp>
							<div className='hr-moment-image'>
								<Clip kind={clip.kind} f={f} />
							</div>
							<span className='hr-category'>{clip.game}</span>
							<h2>{clip.title}</h2>
							<div className='hr-card-bottom'>
								<span>STREAM MOMENT</span>
								{i === 1 && f >= A.select ? <IconCheck size={26} /> : <IconPlayerPlayFilled size={24} />}
							</div>
						</div>
					);
				})}
				<Touch f={f} at={A.select} x={940} y={610} />
			</div>
			{f >= 72 && (
				<div className='hr-lift' style={{ left: 716 - lift * 386, top: 467 - lift * 217, width: 448 + lift * 812, height: 252 + lift * 456 }}>
					<Clip f={f} />
					<div className='hr-lift-title'>
						<span>02:14:08 INTO STREAM</span>
						<b>Insane double backstab</b>
					</div>
				</div>
			)}
		</>
	);
};

const ExportSequence = ({ f }: { f: number }) => {
	const morph = progress(f, 96, 114),
		camera = progress(f, 108, A.cameraLand),
		game = progress(f, 114, A.gameplayLand);
	const ready = f >= A.exportReady;
	return (
		<>
			<Head f={f} at={96} eyebrow='01 / REUSE YOUR MOMENTS'>
				MAKE IT <em>SHAREABLE.</em>
			</Head>
			<div className='hr-export-source' style={{ left: 330 - morph * 190, top: 250 + morph * 60, width: 1260 - morph * 210, height: 708 - morph * 118 }}>
				<Clip f={f} role='source' />
				{f >= 106 && (
					<>
						<div className='hr-source-crop hr-source-crop-camera' style={{ opacity: morph }}>
							CAMERA
						</div>
						<div className='hr-source-crop hr-source-crop-game' style={{ opacity: morph }}>
							GAMEPLAY
						</div>
					</>
				)}
			</div>
			<div className='hr-export-phone' style={{ opacity: morph, transform: `translateX(${(1 - morph) * 200}px)` }}>
				<Stamp>MOBILE / 9:16</Stamp>
				<div className='hr-phone-canvas'>
					<div className='hr-camera-crop' style={{ opacity: camera, transform: `translate(${-650 * (1 - camera)}px,${100 * (1 - camera)}px)` }}>
						<Clip role='camera' />
					</div>
					<div className='hr-game-crop' style={{ opacity: game, transform: `translateX(${-500 * (1 - game)}px)` }}>
						<Clip role='game' />
					</div>
					<div className='hr-output-widget' style={{ opacity: land(f, A.metadataLand - 6), transform: `translateY(${(1 - land(f, A.metadataLand - 6)) * 25}px)` }}>
						<b>INSANE DOUBLE BACKSTAB</b>
						<span>thedannicraft</span>
					</div>
					<div className='hr-output-brand'>
						<Logo height={14} />
						clipify
					</div>
				</div>
			</div>
			<div className={`hr-export-button ${ready ? "is-success" : ""}`} style={{ opacity: land(f, 132), transform: `scale(${f >= 144 && f < 150 ? 0.96 : 1})` }}>
				{ready ? <IconCheck size={33} /> : <IconDownload size={31} />}
				<span>{ready ? "Mobile.mp4" : "Export clip"}</span>
				<b>{ready ? "READY TO SHARE" : "DESKTOP + MOBILE"}</b>
			</div>
			<Touch x={1480} y={925} f={f} at={A.exportPress} />
			{ready && (
				<div className='hr-file-chip' style={{ opacity: land(f, 156), transform: `translateY(${(1 - land(f, 156)) * 18}px)` }}>
					<IconCheck size={20} /> Your layout. Your clip. Ready.
				</div>
			)}
		</>
	);
};

const PlaybackSequence = ({ f }: { f: number }) => {
	const requestFocus = progress(f, 252, 264),
		playing = progress(f, A.requestPlay, A.requestPlay + 14);
	const playerX = 100,
		playerY = 260 + requestFocus * 170 - playing * 170;
	const playerW = 1220 - requestFocus * 480 + playing * 480,
		playerH = (playerW * 9) / 16;
	const kind = f < 228 || f >= 324 ? 0 : 1;
	const redeemed = f >= 276,
		queued = f >= 288,
		nowPlaying = f >= 324;
	const cardToQueue = progress(f, 276, 288),
		cardOut = progress(f, 318, 332);
	const count = f < 288 ? 1 : f < 324 ? 2 : 1;
	const renderViewerRequest = () => (
		<>
			{f >= 252 && (
				<>
					<div className='hr-queue-count'>
						<span>
							VIEWER QUEUE <Pro />
						</span>
						<div key={count} style={{ transform: `translateY(${(1 - land(f, nowPlaying ? 324 : queued ? 288 : 252)) * 15}px)` }}>
							{String(count).padStart(2, "0")}
						</div>
						<small>{nowPlaying ? "REQUEST MOVED INTO PLAYBACK" : queued ? "YOUR REQUEST IS IN THE QUEUE" : "A NEW REQUEST IS COMING IN"}</small>
					</div>
					<div className='hr-redeem-card' style={{ left: 960, top: 340 + cardToQueue * 300, width: 770, height: 245 - cardToQueue * 130, opacity: land(f, 252) * (1 - cardOut), transform: `translateX(${(1 - land(f, 252)) * 140}px) scale(${f >= 276 && f < 280 ? 0.98 : 1})` }}>
						<div className='hr-redeem-icon'>
							<IconBrandTwitch size={37} />
						</div>
						<div className='hr-redeem-text'>
							<span>{queued ? "ADDED TO VIEWER QUEUE" : "CHANNEL POINTS / PLAY A CLIP"}</span>
							<b>Insane double backstab</b>
							{!queued && <small>A moment from your channel.</small>}
						</div>
						<div className={`hr-redeem-button ${redeemed ? "is-success" : ""}`} style={{ opacity: 1 - cardToQueue }}>
							{redeemed ? <IconCheck size={26} /> : "REDEEM"}
						</div>
						{queued && <IconCheck className='hr-queued-check' size={35} />}
					</div>
					<Touch x={1570} y={530} f={f} at={A.redeem} />
					{nowPlaying && (
						<div className='hr-now-playing' style={{ opacity: land(f, 338) }}>
							<IconPlayerPlayFilled size={40} />
							<span>
								YOUR MOMENT.
								<br />
								<b>BACK ON STREAM.</b>
							</span>
						</div>
					)}
				</>
			)}
		</>
	);
	return (
		<>
			<Head f={f} at={192} eyebrow='02 / FUEL YOUR NEXT STREAM'>
				{f < 252 ? (
					<>
						TAKE A BREAK. <em>LET THEM PLAY.</em>
					</>
				) : f < 324 ? (
					<>
						CHAT PICKS <em>THE NEXT MOMENT.</em>
					</>
				) : (
					<>
						REQUESTED. <em>NOW PLAYING.</em>
					</>
				)}
			</Head>
			<div className='hr-player' style={{ left: playerX, top: playerY, width: playerW, height: playerH }}>
				<Clip kind={kind} f={f} />
				<div className='hr-player-brb'>BE RIGHT BACK</div>
				<div className='hr-player-meta'>
					<b>thedannicraft</b>
					<span>{kind === 0 ? "Insane double backstab" : "lol"}</span>
				</div>
				<div className='hr-player-progress' style={{ width: `${linear(f, f < 228 ? 192 : f < 324 ? 228 : 324, f < 228 ? 228 : f < 324 ? 324 : 390) * 100}%` }} />
				{nowPlaying && (
					<div className='hr-requested-tag'>
						<IconCheck size={21} /> VIEWER REQUEST
					</div>
				)}
			</div>
			<div className='hr-queue-context' style={{ opacity: 1 - requestFocus }}>
				<div className='hr-kicker'>AUTOMATIC PLAYBACK</div>
				<h2>
					Clips from
					<br />
					your channel.
				</h2>
				<div className='hr-next-preview' style={{ opacity: land(f, A.upNext) }}>
					<div>
						<Clip kind={1} />
					</div>
					<span>
						UP NEXT<b>lol</b>
					</span>
				</div>
				<span className='hr-context-note'>One browser source in OBS.</span>
			</div>
			{renderViewerRequest()}
		</>
	);
};

const looks = [
	{ name: "MINT / BOLD", background: "#12372b", foreground: "#c1ffe8", accent: "#78e6b1", font: "HeroInter", radius: 15 },
	{ name: "APRICOT / SERIF", background: "#fff0dc", foreground: "#4a271b", accent: "#ffae6c", font: "HeroSerif", radius: 30 },
	{ name: "CYAN / MONO", background: "#071e29", foreground: "#81efff", accent: "#47cfe8", font: "HeroMono", radius: 2 },
];
const StyleSequence = ({ f }: { f: number }) => {
	const i = f < 420 ? 0 : f < 456 ? 1 : 2,
		l = looks[i],
		move = progress(f, A.dragStart, A.dragLand);
	const wx = 60 + move * 650,
		wy = 410 - move * 320;
	return (
		<>
			<Head f={f} at={384} eyebrow='03 / RECOGNIZABLY YOURS'>
				YOUR CHANNEL. <em>YOUR LOOK.</em>
			</Head>
			<div className='hr-custom-player' style={{ "--custom": l.accent } as CSSProperties}>
				<Clip f={f} />
				<div className='hr-player-brb'>BE RIGHT BACK</div>
				<div className='hr-custom-widget' style={{ left: wx, top: wy, background: l.background, color: l.foreground, fontFamily: l.font, borderRadius: l.radius, borderColor: l.accent }}>
					<b>thedannicraft</b>
					<span>Insane double backstab</span>
				</div>
				<div className='hr-widget-handles' style={{ left: wx - 8, top: wy - 8, width: 438, height: 144, borderColor: l.accent }}>
					{[0, 1, 2, 3].map((k) => (
						<i key={k} style={{ background: l.accent }} />
					))}
				</div>
				<div className='hr-custom-progress' style={{ background: l.accent, width: `${linear(f, 324, 550) * 100}%`, height: i === 1 ? 12 : 6 }} />
			</div>
			<div className='hr-look-controls'>
				<span>
					THEME STUDIO <Pro />
				</span>
				{looks.map((l, n) => (
					<div key={l.name} className={n === i ? "is-active" : ""} style={{ background: l.background, color: l.foreground, fontFamily: l.font, borderRadius: l.radius }}>
						<b>Aa</b>
						<span>{l.name}</span>
						{n === i && <IconCheck size={26} />}
					</div>
				))}
				<small>FONT · COLOR · LAYOUT</small>
			</div>
			<Touch x={1620} y={i === 0 ? 407 : i === 1 ? 553 : 699} f={f} at={A.looks[i]} />
			{f >= 480 && <div className='hr-drag-dot' style={{ left: 100 + wx + 180, top: 300 + wy + 60 }} />}
			<div className='hr-custom-caption'>
				<IconPalette size={24} />
				{f >= 504 ? "Your layout, locked in." : "Change the style. Move the information."}
			</div>
		</>
	);
};

const GallerySequence = ({ f }: { f: number }) => {
	const zoom = progress(f, 588, 600);
	return (
		<>
			<Head f={f} at={528} eyebrow='04 / BEYOND THE LIVE STREAM'>
				GIVE YOUR MOMENTS <em>A HOME.</em>
			</Head>
			<div className='hr-web-header' style={{ opacity: 1 - zoom }}>
				<b>
					thedannicraft<span>.gg</span>
				</b>
				<span>HIGHLIGHTS / YOUR WEBSITE</span>
			</div>
			{[0, 1, 0].map((kind, i) => {
				const at = i === 0 ? 528 : A.galleryCards[i - 1];
				const q = land(f, at);
				const hero = i === 0;
				return (
					<div className='hr-gallery-tile' key={i} style={{ left: hero ? 150 + zoom * 180 : 150 + i * 550 + zoom * 1500, top: hero ? 420 - zoom * 130 : 420, width: hero ? 500 + zoom * 760 : 500, height: hero ? 282 + zoom * 426 : 282, opacity: q, transform: `translateY(${(1 - q) * 60}px)` }}>
						<Clip kind={kind} f={f} />
						<div className='hr-gallery-play' style={{ opacity: 1 - zoom }}>
							<IconPlayerPlayFilled size={39} />
						</div>
						<div className='hr-gallery-tile-footer' style={{ opacity: 1 - zoom }}>
							<b>{kind === 0 ? "Insane double backstab" : "lol"}</b>
							<span>{kind === 0 ? "Counter-Strike" : "Minecraft"}</span>
						</div>
						{hero && zoom > 0 && (
							<div className='hr-gallery-open-meta'>
								INSANE DOUBLE BACKSTAB <span>thedannicraft · Clipify gallery</span>
							</div>
						)}
					</div>
				);
			})}
			<Touch x={400} y={555} f={f} at={A.gallerySelect} />
			{f >= 612 && (
				<div className='hr-gallery-note' style={{ opacity: land(f, 612) }}>
					A clip gallery on your website. Ready when they are.
				</div>
			)}
		</>
	);
};

const ClosingSequence = ({ f }: { f: number }) => {
	if (f < 720) {
		const idx = f < 684 ? 0 : f < 696 ? 1 : 2,
			at = A.words[idx],
			q = land(f, at);
		return (
			<div className='hr-kinetic'>
				<h1 style={{ transform: `scale(${0.88 + q * 0.12}) translateX(${(1 - q) * -180}px)` }}>{["REPLAY.", "REUSE.", "REPEAT."][idx]}</h1>
				<span>YOUR LAST STREAM FUELS YOUR NEXT.</span>
			</div>
		);
	}
	const q = land(f, 720),
		cta = land(f, 756);
	return (
		<div className='hr-end'>
			<div className='hr-end-beam' style={{ transform: `translateX(${linear(f, 720, 810) * 210 - 110}%) rotate(-20deg)` }} />
			<div className='hr-end-logo' style={{ transform: `translateY(${(1 - q) * 50}px) scale(${0.7 + q * 0.3})`, opacity: q }}>
				<Logo height={188} />
			</div>
			<h1 style={{ opacity: q, transform: `translateY(${(1 - q) * 35}px)` }}>clipify</h1>
			<p>YOUR LAST STREAM FUELS YOUR NEXT.</p>
			<div className='hr-end-cta' style={{ opacity: cta, transform: `translateY(${(1 - cta) * 28}px)` }}>
				<IconBrandTwitch size={30} />
				<b>Start free with Twitch</b>
				<IconArrowUpRight size={29} />
			</div>
			<strong>CLIPIFY.US</strong>
			<small>Includes Pro features</small>
		</div>
	);
};

// Opaque directional wipes preserve momentum without double-exposing headlines.
// A wipe covers the shot boundary; content switches while fully covered.
const Wipes = ({ f }: { f: number }) => (
	<>
		{[96, 192, 384, 528, 672, 720].map((at) => {
			if (f < at - 6 || f > at + 7) return null;
			const x = interpolate(f, [at - 6, at - 1, at + 1, at + 7], [-100, 0, 0, 100], clamp);
			return (
				<div key={at} className='hr-wipe' style={{ transform: `translateX(${x}%)` }}>
					<div />
				</div>
			);
		})}
	</>
);

export const ClipifyRebuilt = () => {
	const f = useCurrentFrame();
	return (
		<AbsoluteFill className='hr-root'>
			<style>{`@font-face{font-family:HeroInter;src:url('${asset("fonts/Inter.ttf")}');font-weight:100 900;font-display:block}@font-face{font-family:HeroSerif;src:url('${asset("fonts/Serif-Bold.ttf")}');font-weight:700;font-display:block}@font-face{font-family:HeroMono;src:url('${asset("fonts/Mono-Bold.ttf")}');font-weight:700;font-display:block}`}</style>
			<div className='hr-ambient' />
			<div className='hr-brand-grid' />
			<div className='hr-stage' style={{ transform: `translateY(${Math.sin(f / 48) * 2}px)` }}>
				{f < S.export ? <MomentSequence f={f} /> : f < S.playback ? <ExportSequence f={f} /> : f < S.style ? <PlaybackSequence f={f} /> : f < S.gallery ? <StyleSequence f={f} /> : f < S.words ? <GallerySequence f={f} /> : <ClosingSequence f={f} />}
			</div>
			<Wipes f={f} />
			{f < S.brand && (
				<>
					<Brand />
					<div className='hr-site'>CLIPIFY.US</div>
				</>
			)}
			<Html5Audio src={asset("audio/mix.wav")} />
		</AbsoluteFill>
	);
};
