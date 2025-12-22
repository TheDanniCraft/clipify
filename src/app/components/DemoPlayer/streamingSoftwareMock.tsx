type StreamingSoftwareMockProps = {
	children: React.ReactNode;

	title?: string;
	aspectRatio?: string;

	/** Show streaming status in the bottom bar */
	isLive?: boolean;

	/** If live, time in seconds (displayed in bottom bar) */
	liveSeconds?: number;

	/** Parent controls sizing */
	style?: React.CSSProperties;

	/** Bottom-right status text */
	statusRightText?: string;
};

export default function StreamingSoftwareMock({ children, title = "OBS Studio - Profile: Default - Scenes: Clipify Pause", aspectRatio = "16 / 9", isLive = true, liveSeconds = 12 * 60 + 43, style, statusRightText = "CPU: 4.2%   60.00 / 60.00 FPS" }: StreamingSoftwareMockProps) {
	const time = formatHMS(liveSeconds);

	return (
		<div className='obs' style={style}>
			{/* Title bar */}
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

			{/* Preview */}
			<div className='obs__previewArea'>
				<div className='obs__previewBg'>
					<div className='obs__canvas' style={{ aspectRatio }}>
						<div className='obs__scene'>{children}</div>
						<div className='obs__canvasBorder' />
					</div>
				</div>
			</div>

			{/* Docks row */}
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
					<MixerRow label='Desktop Audio' level={0.22} peak={0.62} rightDb='-18.4 dB' />
					<MixerRow label='Mic/Aux' level={0.58} peak={0.92} rightDb='-9.2 dB' />
					<MixerRow label='Music' level={0.12} peak={0.28} muted rightDb='MUTE' />
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

			{/* Status bar */}
			<div className='obs__statusbar'>
				<div className='obs__statusLeft'>
					<span className='obs__pill'>{time}</span>
					<span className='obs__pill'>{time}</span>
					{isLive && <span className='obs__pill obs__pill--live'>LIVE</span>}
				</div>
				<div className='obs__statusRight'>{statusRightText}</div>
			</div>

			<style jsx>{`
				.obs {
					width: 100%;
					min-height: 620px;
					display: grid;
					grid-template-rows: auto 1fr auto auto;
					background: #1b1d22;
					border: 1px solid rgba(255, 255, 255, 0.08);
					border-radius: 12px;
					overflow: hidden;
					box-shadow: 0 20px 70px rgba(0, 0, 0, 0.55);
				}

				/* Title bar */
				.obs__titlebar {
					height: 34px;
					display: flex;
					align-items: center;
					gap: 10px;
					padding: 0 12px;
					background: linear-gradient(180deg, #1f232a, #1a1d23);
					border-bottom: 1px solid rgba(255, 255, 255, 0.06);
				}

				.obs__traffic {
					display: flex;
					gap: 8px;
					flex: 0 0 auto;
				}
				.dot {
					width: 10px;
					height: 10px;
					border-radius: 999px;
					opacity: 0.95;
				}
				.red {
					background: #ff5f57;
				}
				.yellow {
					background: #febc2e;
				}
				.green {
					background: #28c840;
				}

				.obs__title {
					font-size: 12px;
					color: rgba(255, 255, 255, 0.78);
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
					min-width: 0;
					flex: 1 1 auto;
				}

				/* Preview */
				.obs__previewArea {
					background: #13151a;
					display: grid;
				}

				.obs__previewBg {
					position: relative;
					display: grid;
					place-items: center;
					padding: 14px;
					background: radial-gradient(900px 320px at 50% 20%, rgba(255, 255, 255, 0.04), transparent 60%);
				}

				.obs__canvas {
					position: relative;
					width: min(100%, 980px);
					background: #0f1116;
					border: 1px solid rgba(255, 255, 255, 0.12);
					box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.45);
					overflow: hidden;
				}

				.obs__scene {
					position: absolute;
					inset: 0;
				}

				.obs__canvasBorder {
					pointer-events: none;
					position: absolute;
					inset: 0;
					box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
				}

				/* Docks row */
				.obs__docks {
					background: #1c1f25;
					border-top: 1px solid rgba(255, 255, 255, 0.06);
					display: grid;
					grid-template-columns: 1.05fr 1.25fr 1.9fr 1.35fr;
					gap: 8px;
					padding: 8px;
					align-items: stretch;
				}

				@media (max-width: 1100px) {
					.obs__docks {
						grid-template-columns: 1fr 1fr;
					}
				}

				.dock {
					background: #242830;
					border: 1px solid rgba(255, 255, 255, 0.07);
					border-radius: 6px;
					overflow: hidden;
					display: flex;
					flex-direction: column;
					min-width: 0;
				}

				.dock__header {
					height: 28px;
					display: flex;
					align-items: center;
					padding: 0 10px;
					font-size: 12px;
					color: rgba(255, 255, 255, 0.82);
					background: linear-gradient(180deg, #2a2f39, #242830);
					border-bottom: 1px solid rgba(255, 255, 255, 0.06);
				}

				.dock__body {
					padding: 8px;
					flex: 1 1 auto;
					min-height: 150px;
					display: flex;
					flex-direction: column;
				}

				.obs__list {
					display: flex;
					flex-direction: column;
					gap: 6px;
				}

				.obs__row {
					height: 28px;
					display: flex;
					align-items: center;
					gap: 8px;
					padding: 0 8px;
					font-size: 12px;
					color: rgba(255, 255, 255, 0.78);
					border: 1px solid rgba(0, 0, 0, 0.25);
					background: #1f232b;
					border-radius: 4px;
					min-width: 0;
				}

				.obs__row--selected {
					background: #1e4fb8;
					border-color: rgba(255, 255, 255, 0.12);
					color: rgba(255, 255, 255, 0.96);
				}

				.obs__icon {
					opacity: 0.85;
					flex: 0 0 auto;
				}

				.obs__tinyIcon {
					opacity: 0.75;
					font-size: 12px;
					flex: 0 0 auto;
				}

				.obs__spacer {
					flex: 1 1 auto;
					min-width: 0;
				}

				.obs__dockFooter {
					margin-top: auto;
					display: flex;
					gap: 8px;
					align-items: center;
					padding-top: 10px;
					opacity: 0.9;
				}

				.obs__miniBtn {
					width: 26px;
					height: 22px;
					border-radius: 4px;
					border: 1px solid rgba(255, 255, 255, 0.08);
					background: #1f232b;
					color: rgba(255, 255, 255, 0.8);
					font-size: 12px;
					cursor: default;
				}

				/* Mixer footer pinned to bottom */
				.obs__mixerFooter {
					margin-top: auto;
					display: flex;
					justify-content: flex-start;
					gap: 10px;
					padding-top: 8px;
					opacity: 0.85;
				}

				/* Controls */
				.obs__controls {
					display: grid;
					gap: 8px;
					margin-top: 2px;
				}

				.obs__ctrlBtn {
					height: 32px;
					border-radius: 4px;
					border: 1px solid rgba(255, 255, 255, 0.08);
					background: #2a2f39;
					color: rgba(255, 255, 255, 0.86);
					font-size: 12px;
					cursor: default;
				}

				.obs__ctrlBtn.danger {
					border-color: rgba(255, 80, 80, 0.35);
					background: rgba(255, 80, 80, 0.14);
					color: rgba(255, 220, 220, 0.95);
				}

				/* Status bar */
				.obs__statusbar {
					height: 28px;
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: 0 10px;
					background: #1a1d23;
					border-top: 1px solid rgba(255, 255, 255, 0.06);
				}

				.obs__statusLeft {
					display: flex;
					gap: 8px;
					align-items: center;
				}

				.obs__pill {
					height: 18px;
					padding: 0 8px;
					border-radius: 999px;
					background: rgba(255, 255, 255, 0.06);
					border: 1px solid rgba(255, 255, 255, 0.06);
					color: rgba(255, 255, 255, 0.7);
					display: grid;
					place-items: center;
					font-size: 11px;
					font-variant-numeric: tabular-nums;
				}

				.obs__pill--live {
					border-color: rgba(255, 80, 80, 0.35);
					background: rgba(255, 80, 80, 0.12);
					color: rgba(255, 210, 210, 0.95);
				}

				.obs__statusRight {
					font-size: 11px;
					color: rgba(255, 255, 255, 0.7);
					white-space: nowrap;
				}
			`}</style>
		</div>
	);
}

function Dock({ title, children }: { title: string; children: React.ReactNode }) {
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

function MixerRow({
	label,
	level,
	peak,
	muted,
	rightDb,
}: {
	label: string;
	level: number; // 0..1 current fill
	peak: number; // 0..1 peak indicator
	muted?: boolean;
	rightDb: string;
}) {
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

			<style jsx>{`
				.mx {
					margin-bottom: 12px;
				}

				.mx__top {
					display: grid;
					grid-template-columns: 1fr auto;
					gap: 10px;
					align-items: center;
					margin-bottom: 6px;
				}

				.mx__label {
					font-size: 12px;
					color: rgba(255, 255, 255, 0.78);
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}

				.mx__db {
					font-size: 11px;
					color: rgba(255, 255, 255, 0.7);
					font-variant-numeric: tabular-nums;
				}

				.mx__mute {
					font-size: 10px;
					padding: 2px 6px;
					border-radius: 999px;
					border: 1px solid rgba(255, 255, 255, 0.12);
					background: rgba(255, 255, 255, 0.06);
					color: rgba(255, 255, 255, 0.75);
					letter-spacing: 0.04em;
				}

				.mx__meter {
					height: 12px;
					border-radius: 3px;
					overflow: hidden;
					background: #14161b;
					border: 1px solid rgba(255, 255, 255, 0.06);
					position: relative;
				}

				.mx__meter.muted {
					filter: grayscale(0.8);
					opacity: 0.7;
				}

				.mx__fill {
					height: 100%;
					background: linear-gradient(90deg, #14a44d 0%, #22c55e 55%, #eab308 78%, #ef4444 100%);
				}

				.mx__peak {
					position: absolute;
					top: 0;
					width: 2px;
					height: 100%;
					background: rgba(255, 255, 255, 0.9);
					box-shadow: 0 0 6px rgba(255, 255, 255, 0.25);
				}

				.mx__ticks {
					position: absolute;
					inset: 0;
					background-image: repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.12) 0px, rgba(255, 255, 255, 0.12) 1px, transparent 1px, transparent 18px);
					opacity: 0.18;
					pointer-events: none;
				}
			`}</style>
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
