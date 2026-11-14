import { AbsoluteFill, Html5Audio, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import type { CSSProperties, ReactNode } from "react";
import { IconArrowUpRight, IconCheck, IconDownload, IconPlayerPlayFilled, IconPointerFilled, IconBrandTwitch } from "@tabler/icons-react";
import { Gameplay, Brand } from "../moments-preview/MomentsPreview";
import { SCENES as S, TRAILER_EVENTS as E } from "./timeline";
import "./styles.css";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const p = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);
const pop = (f: number, a: number) => spring({ frame: f - a, fps: 30, config: { damping: 20, stiffness: 240, mass: 0.65 } });
const fade = (f: number, a: number, b: number) => p(f, a, a + 6) * (1 - p(f, b - 6, b));
const names = ["The warm-up", "Chat lost it", "The clutch", "One more round"];
const stamps = ["00:18:42", "01:06:12", "02:14:08", "03:28:51"];
const Pointer = ({ x, y, press = false }: { x: number; y: number; press?: boolean }) => <IconPointerFilled className='mt-pointer' size={38} style={{ left: x, top: y, transform: `scale(${press ? 0.8 : 1})` }} />;
const Media = ({ f, variant = 2, camera = false }: { f: number; variant?: number; camera?: boolean }) => (
	<div className='mt-media' style={{ filter: camera ? undefined : `hue-rotate(${(variant - 2) * 31}deg)` }}>
		<Gameplay frame={f + variant * 40} camera={camera} />
		{!camera && (
			<>
				<div className='mt-media-title'>{names[variant % 4]}</div>
				<div className='mt-mini-cam'>
					<Gameplay frame={f} camera />
				</div>
			</>
		)}
	</div>
);
const Pro = () => <span className='mt-pro'>PRO</span>;
const Caption = ({ f, at, children, sub, center = false }: { f: number; at: number; children: ReactNode; sub?: string; center?: boolean }) => {
	const v = pop(f, at);
	return (
		<div className={`mt-caption ${center ? "mt-caption-center" : ""}`} style={{ opacity: v, transform: `translateY(${(1 - v) * 30}px)` }}>
			<h1>{children}</h1>
			{sub && <p>{sub}</p>}
		</div>
	);
};
const Phase = ({ f, start, end, children }: { f: number; start: number; end: number; children: ReactNode }) => (f < start || f >= end ? null : <AbsoluteFill style={{ opacity: fade(f, start, end), pointerEvents: "none" }}>{children}</AbsoluteFill>);

const Overview = ({ f }: { f: number }) => {
	const lift = p(f, E.lift, E.lift + 14),
		selected = f >= E.select;
	return (
		<>
			<div style={{ opacity: 1 - p(f, 96, 108) }}>
				<Caption f={f} at={0} sub='Your last stream. Still full of moments.'>
					STREAM OVER.
					<br />
					<em>MOMENTS? FAR FROM IT.</em>
				</Caption>
				<div className='mt-overview' style={{ transform: `translateY(${(1 - pop(f, 0)) * 85}px)` }}>
					<div className='mt-appbar'>
						<span>STREAM OVERVIEW</span>
						<span>LAST BROADCAST</span>
					</div>
					<div className='mt-stream-heading'>
						<strong>One more game.</strong>
						<span>
							03:42:18 <small>STREAM LENGTH</small>
						</span>
					</div>
					<div className='mt-timeline-line' />
					<span className='mt-start'>STREAM START</span>
					<span className='mt-stop'>STREAM END</span>
					<div className='mt-timeline-cards'>
						{names.map((name, i) => {
							const q = pop(f, E.moments[i]);
							return (
								<div className={`mt-timecard ${i === 2 && selected ? "mt-timecard-selected" : ""}`} key={name} style={{ opacity: q, transform: `translateY(${(1 - q) * 50}px)` }}>
									<span className='mt-time-dot' />
									<div className='mt-timestamp'>{stamps[i]}</div>
									<div className='mt-thumb'>
										<Media f={f} variant={i} />
									</div>
									<strong>{name}</strong>
									<span className='mt-small'>{i === 1 ? "3 clips" : i === 2 ? "2 clips" : "1 clip"}</span>
								</div>
							);
						})}
					</div>
					{f >= E.group && (
						<div className='mt-group' style={{ opacity: pop(f, E.group), transform: `translateY(${(1 - pop(f, E.group)) * 20}px)` }}>
							<span>CLIPS AROUND 02:14:08</span>
							<div>
								<div className={selected ? "active" : ""}>
									<Media f={f} />
									<IconCheck size={18} />
								</div>
								<div>
									<Media f={f} variant={3} />
								</div>
							</div>
						</div>
					)}
					{f >= 66 && <Pointer x={1110 - p(f, 66, E.select) * 290} y={440 - p(f, 66, E.select) * 90} press={selected} />}
				</div>
			</div>
			{f >= 96 && (
				<>
					<Caption f={f} at={96} center>
						THAT MOMENT
						<br />
						<em>HAS MORE TO GIVE.</em>
					</Caption>
					<div className='mt-lifted' style={{ left: 924 - lift * 344, top: 665 - lift * 333, width: 144 + lift * 616, height: 82 + lift * 346, opacity: lift }}>
						<Media f={f} />
						<div className='mt-clip-footer'>
							<span>THE CLUTCH</span>
							<span>YOUR ORIGINAL TWITCH CLIP</span>
						</div>
					</div>
					<div className='mt-destinations' style={{ opacity: pop(f, 108), transform: `translateY(${(1 - pop(f, 108)) * 30}px)` }}>
						{["SHARE", "ON STREAM", "YOUR WEBSITE"].map((n, i) => (
							<div key={n}>
								<span>0{i + 1}</span>
								{n}
								<IconArrowUpRight size={22} />
							</div>
						))}
					</div>
				</>
			)}
		</>
	);
};

const ExportScene = ({ f }: { f: number }) => {
	const camera = pop(f, E.camera),
		game = pop(f, E.gameplay),
		title = pop(f, E.title),
		ready = f >= E.ready;
	return (
		<>
			<Caption f={f} at={144} sub='One clip. Desktop and Mobile versions.'>
				MAKE IT <em>SHAREABLE.</em>
			</Caption>
			<div className='mt-export-source'>
				<div className='mt-surface-label'>
					DESKTOP <span>16:9</span>
				</div>
				<div className='mt-landscape'>
					<Media f={f} />
					<div className='mt-crop-camera'>CAMERA</div>
					<div className='mt-crop-game'>GAMEPLAY</div>
				</div>
			</div>
			<div className='mt-export-arrow'>→</div>
			<div className='mt-export-phone'>
				<div className='mt-surface-label'>
					MOBILE <span>9:16</span>
				</div>
				<div className='mt-vertical'>
					<div className='mt-vertical-camera' style={{ opacity: camera, transform: `translateX(${(1 - camera) * -450}px)` }}>
						<Media f={f} camera />
					</div>
					<div className='mt-vertical-game' style={{ opacity: game, transform: `translateX(${(1 - game) * -450}px)` }}>
						<Media f={f} />
					</div>
					<div className='mt-vertical-title' style={{ opacity: title, transform: `translateY(${(1 - title) * 20}px)` }}>
						THE CLUTCH <small>@YOURCHANNEL</small>
					</div>
					<div className='mt-attribution'>▸ CLIPIFY</div>
				</div>
			</div>
			<div className={`mt-download ${ready ? "mt-ready" : ""}`} style={{ opacity: pop(f, 192) }}>
				{ready ? <IconCheck size={28} /> : <IconDownload size={28} />}
				<span>{ready ? "Mobile.mp4 — ready to share" : "EXPORT CLIP"}</span>
				{ready && <small>DESKTOP + MOBILE</small>}
			</div>
			{f >= 196 && f < 216 && <Pointer x={1510} y={900} press={f >= 204} />}
		</>
	);
};

const looks = [
	{ accent: "#b8ffe2", bg: "#112922", fg: "#b8ffe2", font: "Arial, sans-serif", radius: 12 },
	{ accent: "#ffb069", bg: "#fff0db", fg: "#482a1e", font: "Georgia, serif", radius: 28 },
	{ accent: "#65e8ff", bg: "#06141c", fg: "#65e8ff", font: "monospace", radius: 0 },
];
const OverlayScene = ({ f }: { f: number }) => {
	const styling = f >= S.style,
		styleIndex = f < 480 ? 0 : f < 528 ? 1 : 2,
		look = styling ? looks[styleIndex] : { accent: "#b99aeb", bg: "#171121", fg: "#eee3ff", font: "Arial, sans-serif", radius: 12 };
	const variant = f < E.autoNext ? 2 : f < E.requestPlay ? 3 : 1;
	const clipStart = f < E.autoNext ? 240 : f < E.requestPlay ? 288 : 384;
	const clipEnd = f < E.autoNext ? 288 : f < E.requestPlay ? 384 : 624;
	const localProgress = p(f, clipStart, clipEnd);
	const requested = f >= E.redemption,
		queued = f >= E.queued,
		playing = f >= E.requestPlay;
	const moved = p(f, E.widgetMove, E.widgetMove + 12);
	const vars = { "--look": look.accent, "--look-bg": look.bg, "--look-fg": look.fg, "--look-font": look.font, "--look-radius": `${look.radius}px` } as CSSProperties;
	const renderViewerQueue = () => (
		<>
			{!styling && (
				<>
					<div className='mt-queue-panel'>
						<div className='mt-appbar'>
							UP NEXT <span>AUTOMATIC PLAYBACK</span>
						</div>
						<div className='mt-source-chip'>Clips from your channel</div>
						{[252, 264].map((at, i) => (
							<div key={at} className='mt-next-card' style={{ opacity: pop(f, at), transform: `translateX(${(1 - pop(f, at)) * 30}px)` }}>
								<div>
									<Media f={f} variant={(f < E.autoNext ? [3, 0] : playing ? [0, 3] : [0, 1])[i]} />
								</div>
								<span>
									{names[(f < E.autoNext ? [3, 0] : playing ? [0, 3] : [0, 1])[i]]}
									<small>CHANNEL CLIP</small>
								</span>
							</div>
						))}
						<div className='mt-viewer-header'>
							VIEWER QUEUE <Pro />
						</div>
						<div className='mt-request-card' style={{ opacity: pop(f, E.queued) }}>
							<IconCheck size={20} />
							<span>{playing ? "Now playing: Chat lost it" : queued ? "Chat lost it — queued" : ""}</span>
						</div>
					</div>
					<div className='mt-redemption' style={{ opacity: requested ? pop(f, E.redemption) : 0, transform: `translateY(${(1 - pop(f, E.redemption)) * 25}px)` }}>
						<IconBrandTwitch size={27} />
						<div>
							<strong>
								PLAY A CLIP <Pro />
							</strong>
							<span>Viewer redeemed Channel Points</span>
							<small>clips.twitch.tv / ChatLostIt</small>
						</div>
						<span className='mt-request-status'>{playing ? "PLAYING" : queued ? "QUEUED" : "REQUESTED"}</span>
					</div>
				</>
			)}
		</>
	);
	const renderStage = () => (
		<>
			<Caption f={f} at={styling ? 432 : f < 288 ? 240 : 288} sub={styling ? "Colors. Fonts. Layout. Make it yours." : "Your channel's clips keep playing while you're away."}>
				{styling ? (
					<>
						YOUR CHANNEL. <em>YOUR LOOK.</em>
					</>
				) : f < 288 ? (
					<>
						YOU TAKE <em>A BREAK.</em>
					</>
				) : (
					<>
						YOUR MOMENTS <em>TAKE OVER.</em>
					</>
				)}
			</Caption>
			<div className='mt-live-stage' style={{ transform: `translateY(${Math.sin(f / 40) * 3}px)` }}>
				<div className='mt-appbar'>
					<span>
						<i /> {styling ? "THEME STUDIO" : "NEXT STREAM / BROWSER SOURCE"}
					</span>
					<span>{styling ? <Pro /> : "SCENE: BRB"}</span>
				</div>
				<div className='mt-live-media'>
					<Media f={f} variant={variant} />
					<div className='mt-brb'>BE RIGHT BACK</div>
					<div className='mt-channel-widget' style={{ left: styling ? 40 + moved * 780 : 40, top: styling ? 320 - moved * 255 : 320 }}>
						<b>@YOURCHANNEL</b>
						<span>{names[variant]}</span>
					</div>
					<div className='mt-live-progress' style={{ width: `${localProgress * 100}%` }} />
					{styling && <div className='mt-widget-outline' style={{ left: 40 + moved * 780, top: 320 - moved * 255 }} />}
				</div>
			</div>
		</>
	);
	return (
		<div style={vars}>
			{renderStage()}
			{renderViewerQueue()}
			{styling && (
				<div className='mt-style-panel'>
					<span>MAKE IT YOURS</span>
					{looks.map((l, i) => (
						<div key={l.accent} className={i === styleIndex ? "active" : ""} style={{ background: l.bg, color: l.fg, borderRadius: l.radius, fontFamily: l.font }}>
							<b>Aa</b>
							<span>{["MINT / BOLD", "APRICOT / SERIF", "CYAN / MONO"][i]}</span>
							{i === styleIndex && <IconCheck size={19} />}
						</div>
					))}
					<small>COLOR · TYPOGRAPHY · PLACEMENT</small>
				</div>
			)}
			{styling && <Pointer x={f < 540 ? 1645 : 210 + moved * 780} y={f < 480 ? 385 : f < 528 ? 495 : f < 540 ? 605 : 690 - moved * 255} press={E.styles.some((at) => f >= at && f < at + 5) || f >= 552} />}
			{!styling && f < 252 && <Pointer x={1210} y={320} press />}
		</div>
	);
};

const GalleryScene = ({ f }: { f: number }) => {
	const open = p(f, E.galleryOpen, E.galleryOpen + 12);
	return (
		<>
			<Caption f={f} at={576} sub='Give your highlights a home on your website.'>
				GOOD MOMENTS <em>LIVE ON.</em>
			</Caption>
			<div className='mt-website'>
				<div className='mt-webnav'>
					<strong>
						YOURCHANNEL<span>.gg</span>
					</strong>
					<div>
						ABOUT　 STREAM　 <b>HIGHLIGHTS</b>
					</div>
					<span>YOUR WEBSITE</span>
				</div>
				<div className='mt-gallery-heading'>
					<h2>Worth another watch.</h2>
					<span>CLIP GALLERY</span>
				</div>
				<div className='mt-gallery-grid'>
					{[2, 1, 0, 3].map((v, i) => {
						const at = i === 0 ? 576 : E.tiles[i - 1];
						return (
							<div key={v} className='mt-gallery-card' style={{ opacity: pop(f, at), transform: `translateY(${(1 - pop(f, at)) * 55}px)` }}>
								<div>
									<Media f={f} variant={v} />
									<span className='mt-play-circle'>
										<IconPlayerPlayFilled size={25} />
									</span>
								</div>
								<strong>{names[v]}</strong>
								<small>@yourchannel · Twitch clip</small>
							</div>
						);
					})}
				</div>
				<div className='mt-gallery-bottom'>
					YOUR MOMENTS. READY WHEN THEY ARE.<span>Powered by Clipify</span>
				</div>
				{f >= E.galleryOpen && (
					<div className='mt-gallery-modal' style={{ opacity: open }}>
						<div style={{ transform: `scale(${0.83 + open * 0.17})` }}>
							<Media f={f} />
							<span className='mt-modal-title'>THE CLUTCH　 /　 @YOURCHANNEL</span>
						</div>
					</div>
				)}
				{f >= 630 && f < 660 && <Pointer x={490} y={560} press={f >= 648} />}
			</div>
		</>
	);
};

const Payoff = ({ f }: { f: number }) => {
	const fuel = pop(f, E.fuel);
	return (
		<>
			<Caption f={f} at={f < 768 ? 720 : 768} center>
				{f < 768 ? (
					<>
						YOUR LAST <em>STREAM.</em>
					</>
				) : (
					<>
						FUELS YOUR <em>NEXT.</em>
					</>
				)}
			</Caption>
			<div className='mt-payoff-origin'>
				<span>LAST STREAM</span>
				<div>
					{[0, 1, 2, 3].map((v) => (
						<i key={v}>
							<Media f={f} variant={v} />
						</i>
					))}
				</div>
			</div>
			<div className='mt-use mt-use-share' style={{ transform: `translateX(${-fuel * 50}px) rotate(-5deg)` }}>
				<span>READY TO SHARE</span>
				<div className='mt-use-portrait'>
					<Media f={f} />
				</div>
				<small>
					Mobile.mp4 <IconCheck size={16} />
				</small>
			</div>
			<div className='mt-use mt-use-overlay' style={{ transform: `scale(${0.9 + fuel * 0.15})` }}>
				<span>YOUR NEXT STREAM</span>
				<div>
					<Media f={f} variant={1} />
					<b>BE RIGHT BACK</b>
				</div>
				<small>Clips from your channel · Automatic playback</small>
			</div>
			<div className='mt-use mt-use-gallery' style={{ transform: `translateX(${fuel * 50}px) rotate(5deg)` }}>
				<span>ON YOUR WEBSITE</span>
				<div>
					{[2, 3, 0, 1].map((v) => (
						<i key={v}>
							<Media f={f} variant={v} />
						</i>
					))}
				</div>
				<small>Your clip gallery</small>
			</div>
			<div className='mt-payoff-sub'>THE MOMENTS YOU MADE. MORE WAYS TO USE THEM.</div>
		</>
	);
};

export const MomentsTrailer = () => {
	const f = useCurrentFrame();
	return (
		<AbsoluteFill className='mt-root'>
			<div className='mt-grid' />
			<div className='mt-glow' style={{ transform: `translate(${Math.sin(f / 100) * 60}px,${Math.cos(f / 90) * 30}px)` }} />
			<Brand />
			<div className='mt-review-label'>
				YOUR LAST STREAM → YOUR NEXT <span> / ROUGH CUT</span>
			</div>
			<Phase f={f} start={0} end={150}>
				<Overview f={f} />
			</Phase>
			<Phase f={f} start={144} end={246}>
				<ExportScene f={f} />
			</Phase>
			<Phase f={f} start={240} end={582}>
				<OverlayScene f={f} />
			</Phase>
			<Phase f={f} start={576} end={726}>
				<GalleryScene f={f} />
			</Phase>
			<Phase f={f} start={720} end={870}>
				<Payoff f={f} />
			</Phase>
			{f >= 864 && (
				<AbsoluteFill className='mt-end' style={{ opacity: p(f, 864, 876) }}>
					<div className='mt-end-mark'>▸</div>
					<h1>CLIPIFY</h1>
					<h2>LET YOUR CLIPS TALK.</h2>
					<div className='mt-end-cta' style={{ opacity: pop(f, E.cta), transform: `translateY(${(1 - pop(f, E.cta)) * 20}px)` }}>
						<IconBrandTwitch size={28} />
						START FREE WITH TWITCH
						<IconArrowUpRight size={26} />
					</div>
					<strong>CLIPIFY.US</strong>
					<small>Includes Pro features</small>
				</AbsoluteFill>
			)}
			<div className='mt-footer'>
				<span>CLIPIFY.US</span>
				<span>ILLUSTRATIVE PRODUCT MOCKUPS · ROUGH ANIMATIC</span>
			</div>
			<div className='mt-progress' style={{ width: `${(f / 959) * 100}%` }} />
			<Html5Audio src={staticFile("moments-trailer/audio/mix.wav")} />
		</AbsoluteFill>
	);
};
