import { AbsoluteFill, Html5Audio, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { IconArrowUpRight, IconCheck, IconDownload, IconPlayerPlayFilled, IconPointerFilled, IconScissors } from "@tabler/icons-react";
import { EVENTS as E } from "./timeline";
import "./styles.css";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const p = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);
const enter = (f: number, at: number) => spring({ frame: f - at, fps: 30, config: { damping: 19, stiffness: 230, mass: 0.65 } });

// Deliberately stylized demo media, not a screenshot of an application.
export const Gameplay = ({ frame, camera = false }: { frame: number; camera?: boolean }) =>
	camera ? (
		<svg viewBox='0 0 320 200' preserveAspectRatio='xMidYMid slice' className='mv-media'>
			<rect width='320' height='200' fill='#261a42' />
			<path d='M0 40H320M0 80H320M0 120H320M40 0V200M100 0V200M260 0V200' stroke='#8d42f9' opacity='.28' />
			<rect x='14' y='20' width='50' height='150' rx='20' fill='#8d42f9' opacity='.3' />
			<path d='M76 220Q82 131 160 137Q242 135 253 220' fill='#6355a0' />
			<ellipse cx='162' cy='91' rx='46' ry='56' fill='#d9b8a3' />
			<path d='M115 78Q109 18 163 24Q216 24 211 84L193 56L164 66L139 51Z' fill='#17121f' />
			<path d='M110 95V73Q112 16 164 18Q217 20 218 78V99' fill='none' stroke='#b99aeb' strokeWidth='12' />
			<rect x='103' y='75' width='15' height='38' rx='6' fill='#eee3ff' />
			<rect x='210' y='75' width='15' height='38' rx='6' fill='#eee3ff' />
			<path d={`M147 117Q163 ${130 + Math.sin(frame / 7) * 6} 180 116`} stroke='#734b43' strokeWidth='5' fill='none' />
			<circle cx='145' cy='88' r='4' fill='#211926' />
			<circle cx='180' cy='88' r='4' fill='#211926' />
		</svg>
	) : (
		<svg viewBox='0 0 960 540' preserveAspectRatio='xMidYMid slice' className='mv-media'>
			<defs>
				<linearGradient id='arena' x2='0' y2='1'>
					<stop stopColor='#14273d' />
					<stop offset='1' stopColor='#08111e' />
				</linearGradient>
			</defs>
			<rect width='960' height='540' fill='url(#arena)' />
			<path d='M0 0H960L720 190H240Z' fill='#24364c' />
			<path d='M0 540L330 260H630L960 540' fill='#324355' />
			<path d='M0 95L306 210V380L0 540Z' fill='#526276' />
			<path d='M960 70L645 210V380L960 540Z' fill='#253a4e' />
			<path d='M85 183L255 240V335L85 402Z' fill='#182d42' />
			<path d='M960 150L740 235V350L960 480' stroke='#80dfcf' strokeWidth='7' fill='none' />
			{[0, 1, 2, 3, 4].map((i) => (
				<path key={i} d={`M${i * 230 - 100} 540L${400 + i * 38} 260`} stroke='#63778d' opacity='.45' />
			))}
			<g transform={`translate(${Math.sin(frame / 18) * 22},0)`}>
				<path d='M454 217L465 193H494L507 219L500 295H462Z' fill='#d9a16e' />
				<path d='M465 296L455 340M492 296L505 340' stroke='#e5b785' strokeWidth='12' />
				<path d='M465 225L438 266M495 225L516 260' stroke='#e5b785' strokeWidth='10' />
			</g>
			<g stroke='#b8ffe2' strokeWidth='2'>
				<path d='M468 270H478M488 270H498M483 255V265M483 275V285' />
			</g>
			<path d='M565 540L597 417L645 391L759 424L814 540' fill='#141c2b' />
			<path d='M595 431L547 297L566 287L642 412' fill='#9aa9bb' />
			<path d='M552 302L527 259L545 250L567 288' fill='#29374a' />
			<rect x='25' y='25' width='162' height='30' rx='8' fill='#09121d' opacity='.8' />
			<text x='40' y='46' fill='#b8ffe2' fontSize='17' fontFamily='Arial' fontWeight='700'>
				THE CLUTCH
			</text>
			<text x='36' y='508' fill='#eee3ff' fontSize='28' fontFamily='Arial' fontWeight='700'>
				100 +
			</text>
		</svg>
	);

export const Brand = () => (
	<div className='mv-brand'>
		<svg viewBox='0 0 44 44'>
			<defs>
				<linearGradient id='mv-logo'>
					<stop stopColor='#826aad' />
					<stop offset='1' stopColor='#413f92' />
				</linearGradient>
			</defs>
			<path d='M8 4L40 22L8 40Z' fill='url(#mv-logo)' />
			<path d='M16 15L28 22L16 29Z' fill='white' />
		</svg>
		CLIPIFY
	</div>
);
const Pointer = ({ x, y, press }: { x: number; y: number; press: boolean }) => <IconPointerFilled className='mv-pointer' size={40} style={{ left: x, top: y, transform: `scale(${press ? 0.82 : 1})` }} />;

export const MomentsPreview = () => {
	const f = useCurrentFrame();
	const lift = p(f, E.lift, E.lift + 15),
		editor = p(f, E.editor, E.editor + 15),
		done = p(f, E.ready, E.ready + 10);
	const overviewOut = 1 - p(f, E.lift, E.lift + 12);
	const heading = f < E.lift ? ["YOUR LAST STREAM.", "STILL HITS."] : f < E.editor ? ["THAT MOMENT?", "KEEP IT."] : f < E.ready ? ["ONE CLIP.", "EVERY FORMAT."] : ["MORE THAN", "A MOMENT."];
	const headAt = f < E.lift ? 0 : f < E.editor ? E.lift : f < E.ready ? E.editor : E.ready;
	const h = enter(f, headAt);
	const camera = enter(f, E.camera),
		game = enter(f, E.gameplay),
		title = enter(f, E.title);
	const exportProgress = p(f, E.export, E.ready);
	const beat = (f % 12) / 12;
	const renderHeading = () => (
		<>
			<div className='mv-heading' style={{ opacity: h, transform: `translateY(${(1 - h) * 35}px)` }}>
				<div className='mv-eyebrow'>{f < E.lift ? "01 / REVISIT" : f < E.editor ? "02 / REPLAY" : "03 / REUSE"}</div>
				<h1>
					{heading[0]}
					<br />
					<em>{heading[1]}</em>
				</h1>
				<p>{f < E.lift ? "The moments worth coming back to." : f < E.editor ? "From your stream. Ready for more." : f < E.ready ? "Desktop. Mobile. Your own layout." : "Relive it. Reframe it. Take it with you."}</p>
				{f >= E.ready && (
					<div className='mv-final' style={{ opacity: enter(f, E.payoff), transform: `translateY(${(1 - enter(f, E.payoff)) * 18}px)` }}>
						YOUR CLIPS. MORE LIFE. <IconArrowUpRight size={30} />
					</div>
				)}
			</div>
		</>
	);
	const renderExport = () => (
		<>
			<div className='mv-export' style={{ opacity: p(f, 228, 238), transform: `translateY(${(1 - p(f, 228, 238)) * 20}px)` }}>
				<div className={`mv-export-button ${f >= E.ready ? "mv-export-ready" : ""}`} style={{ transform: `scale(${f >= E.export && f < E.export + 4 ? 0.96 : 1})` }}>
					{f >= E.ready ? <IconCheck size={26} /> : <IconDownload size={26} />} {f >= E.ready ? "YOUR CLIP. READY." : f >= E.export ? "EXPORTING…" : "EXPORT CLIP"}
					<span>{f >= E.ready ? "2 FORMATS" : f >= E.export ? `${Math.round(exportProgress * 100)}%` : "↗"}</span>
				</div>
				<div className='mv-export-track'>
					<i style={{ width: `${exportProgress * 100}%` }} />
				</div>
				{f >= E.ready && (
					<div className='mv-file-tags'>
						<span>
							<IconCheck size={15} /> Desktop.mp4
						</span>
						<span>
							<IconCheck size={15} /> Mobile.mp4
						</span>
					</div>
				)}
			</div>
		</>
	);
	return (
		<AbsoluteFill className='mv-root'>
			<div className='mv-grid' />
			<div className='mv-halo' style={{ transform: `translate(${Math.sin(f / 50) * 35}px,${Math.cos(f / 50) * 22}px)` }} />
			<Brand />
			<div className='mv-top-note'>
				MOMENTS → EXPORT <span> / MOTION STUDY 01</span>
			</div>
			{renderHeading()}
			<div className='mv-overview' style={{ opacity: overviewOut, transform: `translateY(${(1 - enter(f, 0)) * 100 - lift * 40}px)` }}>
				<div className='mv-window-top'>
					<span className='mv-dot' /> STREAM OVERVIEW <span>LAST BROADCAST</span>
				</div>
				<div className='mv-stream-title'>
					One more game.
					<span>
						03:42:18 <small>STREAM LENGTH</small>
					</span>
				</div>
				<div className='mv-wave'>
					{Array.from({ length: 94 }, (_, i) => (
						<i key={i} style={{ height: 18 + Math.sin(i * 1.77) ** 2 * 48 + (i % 7) * 5, opacity: f > i * 0.45 ? 0.8 : 0.15, background: i > 50 && i < 60 ? "#b99aeb" : undefined }} />
					))}
				</div>
				<div className='mv-times'>
					<span>00:00</span>
					<span>01:00</span>
					<span>02:00</span>
					<span>03:42</span>
				</div>
				<div className='mv-moment-list'>
					{["The warm-up", "Chat lost it", "The clutch", "One more round"].map((label, i) => {
						const a = enter(f, E.moments[i]);
						return (
							<div key={label} className={`mv-row ${i === 2 && f >= E.select ? "mv-selected" : ""}`} style={{ opacity: a, transform: `translateX(${(1 - a) * 65}px)` }}>
								<span className='mv-stamp'>{["00:18:42", "01:06:12", "02:14:08", "03:28:51"][i]}</span>
								<div className='mv-row-art'>
									<Gameplay frame={f + i * 28} />
								</div>
								<strong>{label}</strong>
								<span>{["1 clip", "3 clips", "2 clips", "1 clip"][i]}</span>
								<IconPlayerPlayFilled size={20} />
							</div>
						);
					})}
				</div>
				{f >= 72 && <Pointer x={560 - p(f, 72, E.select) * 130} y={500} press={f >= E.select} />}
			</div>
			<div className='mv-source' style={{ opacity: lift, left: 914 - lift * 144 + editor * 20, top: 650 - lift * 398 + editor * 63, width: 96 + lift * 914 - editor * 360, height: 54 + lift * 516 - editor * 204, transform: `translateY(${Math.sin(f / 35) * 3}px) scale(${0.92 + lift * 0.08})` }}>
				<Gameplay frame={f} />
				<div className='mv-face-source'>
					<Gameplay frame={f} camera />
				</div>
				<div className='mv-source-label'>
					<span>THE CLUTCH</span>
					<span>02:14:08 INTO STREAM</span>
				</div>
				{f >= E.editor && (
					<>
						<div className='mv-crop mv-crop-camera' style={{ opacity: 1 - done }}>
							CAMERA <span />
						</div>
						<div className='mv-crop mv-crop-game' style={{ opacity: 1 - done }}>
							GAMEPLAY <span />
						</div>
					</>
				)}
				<div className='mv-source-progress' style={{ width: `${22 + p(f, E.lift, 384) * 57}%` }} />
			</div>
			<div className='mv-desktop-label' style={{ opacity: editor }}>
				DESKTOP <span>16:9</span>
				{done > 0 && <IconCheck size={21} />}
			</div>
			<div className='mv-phone' style={{ opacity: editor, transform: `translateY(${(1 - editor) * 75}px) rotate(${(1 - editor) * 7}deg)` }}>
				<div className='mv-phone-label'>
					MOBILE <span>9:16</span>
				</div>
				<div className='mv-phone-inner'>
					<div className='mv-dropzone'>
						<IconScissors size={38} />
						<span>YOUR COMPOSITION</span>
					</div>
					<div className='mv-camera-output' style={{ opacity: camera, transform: `translate(${-220 * (1 - camera)}px,${-20 * (1 - camera)}px) scale(${0.85 + camera * 0.15})` }}>
						<Gameplay frame={f} camera />
					</div>
					<div className='mv-game-output' style={{ opacity: game, transform: `translateX(${-180 * (1 - game)}px)` }}>
						<Gameplay frame={f} />
					</div>
					<div className='mv-widget' style={{ opacity: title, transform: `translateY(${(1 - title) * 30}px)` }}>
						<span>THE CLUTCH</span>
						<small>@YOURCHANNEL</small>
					</div>
					<div className='mv-watermark'>▸ CLIPIFY</div>
				</div>
			</div>
			{renderExport()}
			{f >= 228 && f < E.export + 9 && <Pointer x={1250 + p(f, 228, 240) * 80} y={865} press={f >= E.export} />}
			<div className='mv-footer'>
				<span>CLIPIFY.US</span>
				<div className='mv-meter'>
					{Array.from({ length: 24 }, (_, i) => (
						<i key={i} style={{ height: 5 + (1 - beat) * 18 * (0.35 + Math.sin(i * 1.4) ** 2 * 0.65) }} />
					))}
				</div>
				<span>ILLUSTRATIVE PRODUCT MOCKUP</span>
			</div>
			<div className='mv-progress' style={{ width: `${(f / 383) * 100}%` }} />
			<Html5Audio src={staticFile("moments-preview/audio/mix.wav")} />
		</AbsoluteFill>
	);
};
