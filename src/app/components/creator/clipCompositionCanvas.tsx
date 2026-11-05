"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Button, Label, Slider, Switch } from "@heroui/react";
import { IconPlayerPlay, IconPlayerPause, IconRefresh } from "@tabler/icons-react";
import { getCreatorClipPreview } from "@actions/creatorLibrary";
import { compositionWidgetTheme, compositionDimensions, updateCompositionFrame, updateCompositionSource, type ClipComposition } from "@lib/clipComposition";
import { notify } from "@lib/toast";
import { clipifyWatermarkSvg, type CreatorBrand, overlayMetadataSvg } from "@lib/overlayMetadata";
import { isTrustedClipMediaUrl } from "@lib/clipExport";
import { compositionLayerColor } from "@lib/clipLayoutTemplate";
import CompositionBox from "./clipCompositionBox";
export default function ClipCompositionCanvas({
	creatorId,
	clip,
	layout,
	selected,
	onSelect,
	onChange,
	onDimensions,
	brand,
	watermark = false,
}: {
	brand?: CreatorBrand | null;
	watermark?: boolean;
	creatorId: string;
	clip: { id: string; title: string; broadcasterName?: string | null; clipCreatorName?: string | null };
	layout: ClipComposition;
	selected: string;
	onSelect: (id: string) => void;
	onChange: (layout: ClipComposition) => void;
	onDimensions: (value: { width: number; height: number }) => void;
}) {
	const widgetImages = useRef(new Map<string, { key: string; image: HTMLImageElement | null; cancel?: () => void }>());
	// Queue raster requests so multiple widgets cannot exhaust preview capacity.
	const nativeRequests = useRef<{ image: HTMLImageElement; url: string; cancelled: boolean }[]>([]);
	const nativeBusy = useRef(false);
	const enqueueNative = useCallback((image: HTMLImageElement, url: string) => {
		const job = { image, url, cancelled: false };
		nativeRequests.current.push(job);
		const pump = () => {
			if (nativeBusy.current) return;
			let next = nativeRequests.current.shift();
			while (next?.cancelled) next = nativeRequests.current.shift();
			if (!next) return;
			const current = next;
			nativeBusy.current = true;
			const loaded = current.image.onload,
				failed = current.image.onerror;
			let completed = false;
			const finish = (callback: () => void) => {
				if (completed) return;
				completed = true;
				try {
					if (!current.cancelled) callback();
				} finally {
					nativeBusy.current = false;
					pump();
				}
			};
			current.image.onload = (event) => finish(() => loaded?.call(current.image, event));
			current.image.onerror = (event) => finish(() => failed?.call(current.image, event));
			current.image.src = current.url;
		};
		pump();
		return () => {
			job.cancelled = true;
		};
	}, []);
	const warnedFont = useRef(false);
	const retryWidgets = useCallback(() => {
		for (const item of widgetImages.current.values()) item.cancel?.();
		widgetImages.current.clear();
		warnedFont.current = false;
	}, []);
	const latestBrand = useRef(brand);
	useEffect(() => {
		latestBrand.current = brand;
	}, [brand]);
	const watermarkImage = useRef<HTMLImageElement | null>(null);
	useEffect(() => {
		if (!watermark) return;
		const image = new Image();
		image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clipifyWatermarkSvg())}`;
		image.onload = () => {
			watermarkImage.current = image;
		};
		return () => {
			watermarkImage.current = null;
		};
	}, [watermark]);
	useEffect(
		() => () => {
			for (const entry of widgetImages.current.values()) entry.cancel?.();
			widgetImages.current.clear();
			nativeRequests.current = [];
		},
		[],
	);
	const avatarData = useRef<string | undefined>(undefined);
	const avatarRevision = useRef(0);
	const sourceStage = useRef<HTMLDivElement>(null),
		outputStage = useRef<HTMLDivElement>(null),
		video = useRef<HTMLVideoElement>(null),
		canvas = useRef<HTMLCanvasElement>(null),
		latest = useRef(layout),
		logo = useRef<HTMLImageElement | null>(null);
	const [sourceGuides, setSourceGuides] = useState<{ x?: number; y?: number }>({});
	const [url, setUrl] = useState<string | null>(),
		[retry, setRetry] = useState(0),
		[ready, setReady] = useState(false),
		[failed, setFailed] = useState(false),
		[logoFailed, setLogoFailed] = useState(false),
		[playing, setPlaying] = useState(false),
		[time, setTime] = useState(0),
		[duration, setDuration] = useState(0),
		[dimensions, setDimensions] = useState({ width: 1920, height: 1080 }),
		[snapping, setSnapping] = useState(true),
		[guides, setGuides] = useState<{ x?: number; y?: number }>({});
	useEffect(() => {
		latest.current = layout;
		const ids = new Set(layout.layers.map((layer) => layer.id));
		for (const id of widgetImages.current.keys())
			if (!ids.has(id)) {
				widgetImages.current.get(id)?.cancel?.();
				widgetImages.current.delete(id);
			}
	}, [layout]);
	const output = compositionDimensions(layout.format),
		needsLogo = layout.layers.some((layer) => layer.kind === "logo" || layer.kind === "channel");
	useEffect(() => {
		let current = true;
		void getCreatorClipPreview({ creatorId, clipId: clip.id, ...(retry ? { refresh: true } : {}) })
			.then((result) => {
				if (current) setUrl(result?.playbackUrl ? (isTrustedClipMediaUrl(result.playbackUrl) ? `/api/clips/preview?creatorId=${encodeURIComponent(creatorId)}&clipId=${encodeURIComponent(clip.id)}&attempt=${retry}` : result.playbackUrl) : null);
			})
			.catch(() => {
				if (current) setUrl(null);
			});
		return () => {
			current = false;
		};
	}, [creatorId, clip.id, retry]);
	useEffect(() => {
		if (!needsLogo) {
			logo.current = null;
			avatarData.current = undefined;
			return;
		}
		let active = true;
		const image = new Image();
		image.onload = () => {
			if (active) {
				logo.current = image;
				const buffer = document.createElement("canvas");
				buffer.width = image.width;
				buffer.height = image.height;
				try {
					buffer.getContext("2d")?.drawImage(image, 0, 0);
					avatarData.current = buffer.toDataURL("image/png");
					avatarRevision.current++;
				} catch {
					avatarData.current = undefined;
				}
				setLogoFailed(false);
			}
		};
		image.onerror = () => {
			if (active) setLogoFailed(true);
		};
		image.src = `/api/clips/layout-logo?creatorId=${encodeURIComponent(creatorId)}&attempt=${retry}`;
		return () => {
			active = false;
			logo.current = null;
		};
	}, [creatorId, needsLogo, retry]);
	useEffect(() => {
		if (!url || !ready) return;
		let frame = 0;
		const draw = () => {
			const v = video.current,
				c = canvas.current,
				ctx = c?.getContext("2d"),
				l = latest.current;
			if (v && c && ctx && v.readyState >= 2 && v.videoWidth) {
				try {
					ctx.fillStyle = "#000";
					ctx.fillRect(0, 0, c.width, c.height);
					for (const layer of l.layers) {
						const w = Math.max(2, Math.trunc((layer.frame.w * c.width) / 2) * 2),
							h = Math.max(2, Math.trunc((layer.frame.h * c.height) / 2) * 2),
							x = Math.trunc((layer.frame.x * c.width) / 2) * 2,
							y = Math.trunc((layer.frame.y * c.height) / 2) * 2;
						ctx.save();
						try {
							ctx.beginPath();
							ctx.rect(x, y, w, h);
							ctx.clip();
							if (layer.kind === "video") {
								const s = layer.source,
									sw = Math.max(2, Math.trunc((s.w * v.videoWidth) / 2) * 2),
									sh = Math.max(2, Math.trunc((s.h * v.videoHeight) / 2) * 2),
									scale = Math.min(w / sw, h / sh);
								ctx.drawImage(v, Math.trunc((s.x * v.videoWidth) / 2) * 2, Math.trunc((s.y * v.videoHeight) / 2) * 2, sw, sh, x + (w - sw * scale) / 2, y + (h - sh * scale) / 2, sw * scale, sh * scale);
							} else if (layer.kind === "logo") {
								const image = logo.current;
								if (image) {
									const scale = Math.min(w / image.width, h / image.height);
									ctx.drawImage(image, x + (w - image.width * scale) / 2, y + (h - image.height * scale) / 2, image.width * scale, image.height * scale);
								}
							} else {
								const key = JSON.stringify([layer.kind, layer.fontSize, compositionWidgetTheme(latest.current, layer, latestBrand.current), clip.title, clip.broadcasterName, clip.clipCreatorName, w, h, avatarRevision.current]);
								let cached = widgetImages.current.get(layer.id);
								if (cached?.key !== key) {
									cached?.cancel?.();
									const theme = compositionWidgetTheme(latest.current, layer, latestBrand.current);
									const svg = overlayMetadataSvg(layer.kind, clip, w, h, layer.fontSize, theme, avatarData.current, undefined, latestBrand.current?.fontFamily);
									const image = new Image();
									cached = { key, image: cached?.image ?? null };
									widgetImages.current.set(layer.id, cached);
									image.onload = () => {
										const current = widgetImages.current.get(layer.id);
										if (current?.key === key) current.image = image;
									};
									image.onerror = () => {
										if (widgetImages.current.get(layer.id)?.key !== key) return;
										if (!latestBrand.current) {
											setFailed(true);
											return;
										}
										if (!warnedFont.current) {
											warnedFont.current = true;
											notify({
												title: "Font preview unavailable",
												description: (
													<div className='space-y-2'>
														<p>Your video and layout are preserved. Retry or choose another font in Brand styling.</p>
														<Button variant='secondary' onPress={retryWidgets}>
															Retry widgets
														</Button>
													</div>
												),
												color: "danger",
											});
										}
									};
									if (latestBrand.current) {
										const payload = { creatorId, kind: layer.kind, width: w, height: h, fontSize: layer.fontSize, clip, theme };
										let cancelRequest: (() => void) | undefined;
										const timer = setTimeout(() => {
											cancelRequest = enqueueNative(image, `/api/clips/widget-preview?data=${encodeURIComponent(JSON.stringify(payload))}`);
										}, 250);
										cached.cancel = () => {
											clearTimeout(timer);
											cancelRequest?.();
										};
									} else image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
								}
								if (cached.image) ctx.drawImage(cached.image, x, y, w, h);
							}
						} finally {
							ctx.restore();
						}
					}
					if (watermark && watermarkImage.current) ctx.drawImage(watermarkImage.current, c.width - 216, c.height - 60, 200, 44);
				} catch {
					setFailed(true);
					return;
				}
			}
			frame = requestAnimationFrame(draw);
		};
		frame = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(frame);
	}, [url, ready, clip, layout.format, watermark, creatorId, retryWidgets, enqueueNative]);
	const retryMedia = () => {
		for (const entry of widgetImages.current.values()) entry.cancel?.();
		widgetImages.current.clear();
		setUrl(undefined);
		setReady(false);
		setPlaying(false);
		setLogoFailed(false);
		setRetry((n) => n + 1);
		setFailed(false);
	};

	return (
		<div className='space-y-4'>
			<div className='relative'>
				<div className='grid items-start gap-4 lg:grid-cols-[var(--source-column)_var(--output-column)]' style={{ "--source-column": `${dimensions.width / dimensions.height}fr`, "--output-column": `${output.width / output.height}fr` } as CSSProperties}>
					<section className='min-w-0 space-y-2'>
						<h3 className='text-sm font-medium'>Source crops</h3>
						<div ref={sourceStage} className='relative overflow-hidden rounded-lg bg-black' style={{ aspectRatio: dimensions.width / dimensions.height }}>
							<video
								ref={video}
								crossOrigin='anonymous'
								src={url ?? undefined}
								muted
								playsInline
								preload='auto'
								className='absolute inset-0 h-full w-full'
								onLoadedMetadata={() => {
									const v = video.current;
									if (v) {
										setDimensions({ width: v.videoWidth, height: v.videoHeight });
										onDimensions({ width: v.videoWidth, height: v.videoHeight });
										setDuration(Number.isFinite(v.duration) ? v.duration : 0);
									}
								}}
								onLoadedData={() => setReady(true)}
								onError={() => setFailed(true)}
								onPause={() => setPlaying(false)}
								onPlay={() => setPlaying(true)}
								onTimeUpdate={() => setTime(video.current?.currentTime ?? 0)}
							/>
							{ready
								? layout.layers
										.filter((layer) => layer.kind === "video")
										.map((layer) => (
											<CompositionBox
												key={layer.id}
												color={compositionLayerColor(layer.id)}
												rect={layer.source}
												label={`${layer.label} crop`}
												selected={selected === layer.id}
												stage={sourceStage}
												dimensions={dimensions}
												onSelect={() => onSelect(layer.id)}
												snap={snapping}
												onGuides={setSourceGuides}
												targets={layout.layers.filter((item) => item.id !== layer.id && item.kind === "video").map((item) => (item.kind === "video" ? item.source : item.frame))}
												onChange={(source) => onChange(updateCompositionSource(layout, layer.id, source, dimensions))}
												ratio={() => (layer.frame.w * output.width * dimensions.height) / (layer.frame.h * output.height * dimensions.width)}
											/>
										))
								: null}
							{sourceGuides.x !== undefined ? <div className='pointer-events-none absolute inset-y-0 w-px bg-accent' style={{ left: `${sourceGuides.x * 100}%` }} /> : null}
							{sourceGuides.y !== undefined ? <div className='pointer-events-none absolute inset-x-0 h-px bg-accent' style={{ top: `${sourceGuides.y * 100}%` }} /> : null}
						</div>
					</section>
					<section className='min-w-0 space-y-2'>
						<h3 className='text-sm font-medium'>{layout.format === "mobile" ? "Mobile 9:16" : "Desktop 16:9"}</h3>
						<div ref={outputStage} className={`relative mx-auto w-full overflow-hidden rounded-lg bg-black ${layout.format === "mobile" ? "max-w-72 lg:max-w-none" : ""}`} style={{ aspectRatio: output.width / output.height }}>
							<canvas ref={canvas} width={output.width} height={output.height} aria-label='Layout preview' className='block h-full w-full' />
							{ready
								? layout.layers.map((layer) => (
										<CompositionBox
											key={layer.id}
											color={compositionLayerColor(layer.id)}
											rect={layer.frame}
											label={`${layer.label} output`}
											showLabel={layer.kind === "video"}
											selected={selected === layer.id}
											stage={outputStage}
											dimensions={output}
											snap={snapping}
											targets={layout.layers.filter((item) => item.id !== layer.id).map((item) => item.frame)}
											onGuides={setGuides}
											onSelect={() => onSelect(layer.id)}
											onChange={(frame) => onChange(updateCompositionFrame(layout, layer.id, frame, dimensions))}
											ratio={layer.kind === "logo" ? (_e, start) => start.w / start.h : (e, start) => (e.shiftKey ? start.w / start.h : undefined)}
										/>
									))
								: null}
							{guides.x !== undefined ? <div className='pointer-events-none absolute inset-y-0 w-px bg-accent' style={{ left: `${guides.x * 100}%` }} /> : null}
							{guides.y !== undefined ? <div className='pointer-events-none absolute inset-x-0 h-px bg-accent' style={{ top: `${guides.y * 100}%` }} /> : null}
						</div>
					</section>
				</div>
				{!ready || failed ? (
					<div className='absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-xl bg-background/90 p-4 text-center'>
						<p className='text-sm text-muted'>{url !== null && !failed ? "Loading clip preview…" : "Clip preview unavailable. Retry or choose another reference clip."}</p>
						{url === null || failed ? (
							<Button variant='secondary' onPress={retryMedia}>
								<IconRefresh className='size-4' />
								Retry preview
							</Button>
						) : null}
					</div>
				) : null}
			</div>
			<div className='flex items-center gap-3'>
				<Button
					variant='secondary'
					isDisabled={!ready || failed}
					aria-label={playing ? "Pause preview" : "Play preview"}
					onPress={() => {
						const v = video.current;
						if (v) {
							if (v.paused) void v.play().catch(() => setFailed(true));
							else v.pause();
						}
					}}
				>
					{playing ? <IconPlayerPause className='size-4' /> : <IconPlayerPlay className='size-4' />}
					{playing ? "Pause" : "Play"}
				</Button>
				<Slider
					isDisabled={!ready || failed}
					className='min-w-0 flex-1'
					aria-label='Preview position'
					minValue={0}
					maxValue={duration || 1}
					step={0.1}
					value={time}
					onChange={(value) => {
						if (typeof value === "number" && video.current) {
							video.current.currentTime = value;
							setTime(value);
						}
					}}
				>
					<Label className='sr-only'>Preview position</Label>
					<Slider.Track>
						<Slider.Fill />
						<Slider.Thumb />
					</Slider.Track>
				</Slider>
				<span className='text-xs tabular-nums text-muted'>
					{Math.floor(time)} / {Math.floor(duration)}s
				</span>
			</div>
			{needsLogo && logoFailed ? (
				<div className='flex items-center gap-3 text-sm text-muted' role='status'>
					Channel logo unavailable.
					<Button size='sm' variant='secondary' onPress={retryMedia}>
						Retry logo
					</Button>
				</div>
			) : null}
			<Switch isSelected={snapping} onChange={setSnapping} aria-label='Snapping'>
				<Switch.Content>
					<Switch.Control>
						<Switch.Thumb />
					</Switch.Control>
					<Label>Snapping</Label>
				</Switch.Content>
			</Switch>
			<p className='text-xs text-muted'>Shape and arrange boxes in the output. Move or scale the matching source crop to choose content. Resize the output to scale it. Shift preserves the output shape. Boxes snap to edges and other boxes; hold Control or Alt to bypass. Arrow keys move one pixel.</p>
		</div>
	);
}
