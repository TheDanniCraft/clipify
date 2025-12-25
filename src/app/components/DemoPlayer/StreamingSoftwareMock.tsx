import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import "./StreamingSoftwareMock.css";

type StreamingSoftwareMockProps = {
	children: ReactNode;

	title?: string;
	aspectRatio?: string;

	isLive?: boolean;
	liveSeconds?: number;

	style?: CSSProperties;
	statusRightText?: string;
};

export default function StreamingSoftwareMock({ children, title = "OBS Studio - Profile: Default - Scenes: Clipify Pause", aspectRatio = "16 / 9", isLive = true, liveSeconds = 12 * 60 + 43, style, statusRightText = "CPU: 4.2%   60.00 / 60.00 FPS" }: StreamingSoftwareMockProps) {
	const [seconds, setSeconds] = useState(liveSeconds);

	useEffect(() => {
		if (!isLive) setSeconds(liveSeconds);
	}, [liveSeconds, isLive]);

	useEffect(() => {
		if (!isLive) return;
		const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
		return () => window.clearInterval(id);
	}, [isLive]);

	const time = formatHMS(seconds);
	const mixer = useFakeMixer(isLive);

	return (
		<div className='obs' style={style}>
			<div className='obs__titlebar'>
				<div className='obs__traffic' aria-hidden>
					<span className='dot red' />
					<span className='dot yellow' />
					<span className='dot green' />
				</div>
				<div className='obs__title' title={title}>
					{title}
				</div>
			</div>

			<div className='obs__previewArea'>
				<div className='obs__previewBg'>
					<div className='obs__canvas' style={{ aspectRatio }}>
						<div className='obs__scene'>{children}</div>
						<div className='obs__canvasBorder' />
					</div>
				</div>
			</div>

			<div className='obs__docks'>
				<Dock title='Scenes'>
					<div className='obs__list'>
						<div className='obs__row obs__row--selected'>Scene</div>
					</div>
					<DockFooter />
				</Dock>

				<Dock title='Sources'>
					<div className='obs__list'>
						<div className='obs__row'>
							<span className='obs__icon' aria-hidden>
								⦿
							</span>
							Browser
							<span className='obs__spacer' />
							<span className='obs__tinyIcon' aria-hidden title='Visible'>
								👁
							</span>
							<span className='obs__tinyIcon' aria-hidden title='Locked'>
								🔒
							</span>
						</div>
					</div>
					<DockFooter />
				</Dock>

				<Dock title='Audio Mixer'>
					<MixerRow label='Desktop Audio' level={mixer.desktop.level} peak={mixer.desktop.peak} rightDb={formatDb(mixer.desktop.level)} />
					<MixerRow label='Mic/Aux' level={mixer.mic.level} peak={mixer.mic.peak} rightDb={formatDb(mixer.mic.level)} />
					<MixerRow label='Music' level={mixer.music.level} peak={mixer.music.peak} muted rightDb='MUTE' />
				</Dock>

				<Dock title='Controls'>
					<div className='obs__controls'>
						<button type='button' className={`obs__ctrlBtn ${isLive ? "danger" : ""}`}>
							{isLive ? "Stop Streaming" : "Start Streaming"}
						</button>
						<button type='button' className='obs__ctrlBtn'>
							Start Recording
						</button>
						<button type='button' className='obs__ctrlBtn'>
							Settings
						</button>
						<button type='button' className='obs__ctrlBtn'>
							Exit
						</button>
					</div>
				</Dock>
			</div>

			<div className='obs__statusbar'>
				<div className='obs__statusLeft'>
					<span className='obs__pill'>{time}</span>
					{isLive && <span className='obs__pill obs__pill--live'>LIVE</span>}
				</div>
				<div className='obs__statusRight'>{statusRightText}</div>
			</div>
		</div>
	);
}

function Dock({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className='dock'>
			<div className='dock__header'>{title}</div>
			<div className='dock__body'>{children}</div>
		</div>
	);
}

function DockFooter() {
	return (
		<div className='obs__dockFooter' aria-hidden>
			<button type='button' className='obs__miniBtn' title='Add'>
				+
			</button>
			<button type='button' className='obs__miniBtn' title='Remove'>
				🗑
			</button>
			<button type='button' className='obs__miniBtn' title='Settings'>
				⚙
			</button>
			<button type='button' className='obs__miniBtn' title='More'>
				▾
			</button>
		</div>
	);
}

function MixerRow({ label, level, peak, muted, rightDb }: { label: string; level: number; peak: number; muted?: boolean; rightDb: string }) {
	const clamped = (n: number) => Math.max(0, Math.min(1, n));
	const lvl = clamped(level);
	const pk = clamped(peak);

	return (
		<div className='mx'>
			<div className='mx__top'>
				<div className='mx__label'>{label}</div>
				<div className='mx__right'>{muted ? <span className='mx__mute'>MUTE</span> : <span className='mx__db'>{rightDb}</span>}</div>
			</div>

			<div className={`mx__meter ${muted ? "muted" : ""}`}>
				<div className='mx__fill' style={{ width: `${lvl * 100}%` }} />
				<div className='mx__peak' style={{ left: `calc(${pk * 100}% - 1px)` }} />
				<div className='mx__ticks' />
			</div>
		</div>
	);
}

function formatHMS(totalSeconds: number) {
	const s = Math.max(0, Math.floor(totalSeconds));
	const hh = Math.floor(s / 3600);
	const mm = Math.floor((s % 3600) / 60);
	const ss = s % 60;
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

function levelToDb(level: number) {
	const l = Math.max(0.0005, Math.min(1, level));
	return Math.max(-60, Math.min(0, 20 * Math.log10(l)));
}

function formatDb(level: number) {
	return `${levelToDb(level).toFixed(1)} dB`;
}

function useFakeMixer(isRunning: boolean) {
	const [mixer, setMixer] = useState(() => ({
		desktop: { level: 0.22, peak: 0.62 },
		mic: { level: 0.58, peak: 0.92 },
		music: { level: 0.34, peak: 0.42 },
	}));

	const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
	const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

	const desk = useRef({ mean: 0.32, dev: 0.05, target: 0.32 });
	const mus = useRef({ mean: 0.34, dev: 0.035, target: 0.34 });
	const mic = useRef({ mean: 0.48, dev: 0.18, target: 0.48 });

	const peaksRef = useRef({ desktop: 0.0, mic: 0.0, music: 0.0 });

	useEffect(() => {
		if (!isRunning) return;

		let raf = 0;
		let last = performance.now();
		let acc = 0;

		const tick = (now: number) => {
			const dt = (now - last) / 1000;
			last = now;
			acc += dt;

			if (acc >= 0.6) {
				const n = () => (Math.random() - 0.5) * 2;

				desk.current.target = clamp01(desk.current.mean + n() * desk.current.dev);
				mus.current.target = clamp01(mus.current.mean + n() * mus.current.dev);

				const micJump = Math.random() < 0.3 ? 2.0 : 1.0;
				mic.current.target = clamp01(mic.current.mean + n() * mic.current.dev * micJump);

				acc = 0;
			}

			setMixer((prev) => {
				const smoothT = 1 - Math.pow(0.08, dt);

				const desktopLevel = lerp(prev.desktop.level, desk.current.target, smoothT);
				const micLevel = lerp(prev.mic.level, mic.current.target, smoothT);
				const musicLevel = lerp(prev.music.level, mus.current.target, smoothT);

				const decay = (p: number, perSec: number) => Math.max(0, p - perSec * dt);

				const desktopPeak = Math.max(decay(peaksRef.current.desktop, 0.22), desktopLevel);
				const micPeak = Math.max(decay(peaksRef.current.mic, 0.38), micLevel);
				const musicPeak = Math.max(decay(peaksRef.current.music, 0.18), musicLevel);

				peaksRef.current.desktop = desktopPeak;
				peaksRef.current.mic = micPeak;
				peaksRef.current.music = musicPeak;

				return {
					desktop: { level: desktopLevel, peak: desktopPeak },
					mic: { level: micLevel, peak: micPeak },
					music: { level: musicLevel, peak: musicPeak },
				};
			});

			raf = requestAnimationFrame(tick);
		};

		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [isRunning]);

	return mixer;
}
