"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Button, Card, Label, Link, Slider, Checkbox, Modal } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useNavigationGuard } from "nextjs-nav-guard";
import ControlledModal from "@components/controlledModal";
import { IconArrowLeft, IconPlayerPlay, IconPlayerPause, IconRefresh, IconArrowsDiagonal } from "@tabler/icons-react";
import { getCreatorClipPreview, type getCreatorClipDetail } from "@actions/creatorLibrary";
import { loadClipLayout, saveClipLayout } from "@actions/clipLayouts";
import { defaultClipLayout, clipLayoutSchema, sourceCrop, clipLayerText, clipLayerLines, type ClipLayout, type ClipCrop } from "@lib/clipLayout";
import DashboardEditorLayout from "@components/dashboardEditorLayout";
import ClipExport from "./clipExport";
import { notify } from "@lib/toast";

type Detail = Awaited<ReturnType<typeof getCreatorClipDetail>>;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
function Range({ label, value, min = 0, max = 100, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (v: number) => void }) {
	return (
		<Slider
			value={value}
			minValue={min}
			maxValue={max}
			step={1}
			onChange={(v) => {
				if (typeof v === "number") onChange(v);
			}}
		>
			<Label>{label}</Label>
			<Slider.Output />
			<Slider.Track>
				<Slider.Fill />
				<Slider.Thumb />
			</Slider.Track>
		</Slider>
	);
}
export default function ClipLayoutEditor({ creatorId, ids, data }: { creatorId: string; ids: string[]; data: Detail }) {
	const router = useRouter();
	const [layout, setLayout] = useState<ClipLayout>(defaultClipLayout),
		[selected, setSelected] = useState<"gameplay" | "camera">("gameplay");
	const [source, setSource] = useState<string | null>(),
		[retry, setRetry] = useState(0),
		[playing, setPlaying] = useState(false),
		[time, setTime] = useState(0),
		[duration, setDuration] = useState(0),
		[loaded, setLoaded] = useState(false),
		[saving, setSaving] = useState(false),
		[dirty, setDirty] = useState(false);
	const video = useRef<HTMLVideoElement>(null),
		canvas = useRef<HTMLCanvasElement>(null),
		latest = useRef(layout);
	const clip = data.ok ? data.clip : null;
	const navGuard = useNavigationGuard({ enabled: dirty });
	useEffect(() => {
		latest.current = layout;
	}, [layout]);
	useEffect(() => {
		let current = true;
		void loadClipLayout(creatorId)
			.then((r) => {
				if (!current) return;
				if (r.ok && r.layout) setLayout(r.layout);
				else if (!r.ok) notify({ title: "Saved layout could not be loaded", description: "You can still edit and export this clip.", color: "warning" });
			})
			.catch(() => {
				if (current) notify({ title: "Saved layout could not be loaded", color: "warning" });
			})
			.finally(() => {
				if (current) setLoaded(true);
			});
		return () => {
			current = false;
		};
	}, [creatorId]);
	useEffect(() => {
		let current = true;
		void getCreatorClipPreview({ creatorId, clipId: ids[0] })
			.then((r) => {
				if (current) setSource(r?.playbackUrl ?? null);
			})
			.catch(() => {
				if (current) setSource(null);
			});
		return () => {
			current = false;
		};
	}, [creatorId, ids, retry]);
	useEffect(() => {
		if (!dirty) return;
		const warn = (e: BeforeUnloadEvent) => {
			e.preventDefault();
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);
	useEffect(() => {
		if (!clip || !source) return;
		let frame = 0,
			failed = false;
		const draw = () => {
			const v = video.current,
				c = canvas.current,
				l = latest.current,
				ctx = c?.getContext("2d");
			if (v && c && ctx && v.readyState >= 2 && v.videoWidth) {
				try {
					ctx.fillStyle = "#000";
					ctx.fillRect(0, 0, 720, 1280);
					const cameraHeight = l.mode === "stacked" ? Math.round((1280 * l.cameraShare) / 2) * 2 : 0;
					for (const [crop, y, h] of [[l.gameplay, cameraHeight, 1280 - cameraHeight], ...(cameraHeight ? [[l.camera, 0, cameraHeight]] : [])] as [ClipCrop, number, number][]) {
						const r = sourceCrop(crop, v.videoWidth, v.videoHeight, 720, h);
						ctx.drawImage(v, r.x, r.y, r.w, r.h, 0, y, 720, h);
					}
					for (const layer of l.textLayers) {
						const lines = clipLayerLines(clipLayerText(layer.field, clip), layer.size);

						ctx.font = `${layer.size}px "DejaVu Sans",sans-serif`;
						const w = Math.max(0, ...lines.map((line) => ctx.measureText(line).width)),
							x = Math.max(8, Math.min(720 - w - 8, (720 * layer.x) / 100)),
							y = Math.min(1280 - layer.size * lines.length - 8, (1280 * layer.y) / 100);
						ctx.fillStyle = "rgba(0,0,0,.65)";
						ctx.fillRect(x - 6, y - 6, w + 12, layer.size * lines.length + 12);
						ctx.fillStyle = "#fff";
						ctx.textBaseline = "top";
						lines.forEach((line, index) => ctx.fillText(line, x, y + index * layer.size, 704));
					}
				} catch {
					if (!failed) {
						failed = true;
						notify({ title: "Portrait preview unavailable", description: "Retry the source clip. Your layout is kept.", color: "warning" });
					}
				}
			}
			frame = requestAnimationFrame(draw);
		};
		frame = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(frame);
	}, [source, clip]);
	const change = (next: ClipLayout) => {
		const parsed = clipLayoutSchema.safeParse(next);
		if (parsed.success) {
			setLayout(parsed.data);
			setDirty(true);
		}
	};
	const updateCrop = (patch: Partial<ClipCrop>) => {
		const next = { ...layout[selected], ...patch };
		next.x = clamp(next.x, 0, 1 - next.w);
		next.y = clamp(next.y, 0, 1 - next.h);
		change({ ...layout, [selected]: next });
	};
	const drag = (event: PointerEvent, kind: "gameplay" | "camera", resize = false) => {
		if (event.button !== 0) return;
		event.preventDefault();
		setSelected(kind);
		const box = (event.currentTarget.closest("[data-source-stage]") as HTMLElement | null)?.getBoundingClientRect();
		if (!box) return;
		const node = event.currentTarget;
		node.setPointerCapture(event.pointerId);
		const original = layout[kind],
			x = event.clientX,
			y = event.clientY;
		const move = (e: globalThis.PointerEvent) => {
			const dx = (e.clientX - x) / box.width,
				dy = (e.clientY - y) / box.height;
			const crop = resize ? { ...original, w: clamp(original.w + dx, 0.02, 1 - original.x), h: clamp(original.h + dy, 0.02, 1 - original.y) } : { ...original, x: clamp(original.x + dx, 0, 1 - original.w), y: clamp(original.y + dy, 0, 1 - original.h) };
			setLayout((l) => ({ ...l, [kind]: crop }));
			setDirty(true);
		};
		const end = () => {
			node.removeEventListener("pointermove", move as EventListener);
			node.removeEventListener("pointerup", end);
			node.removeEventListener("pointercancel", end);
		};
		node.addEventListener("pointermove", move as EventListener);
		node.addEventListener("pointerup", end, { once: true });
		node.addEventListener("pointercancel", end, { once: true });
	};
	if (!clip)
		return (
			<DashboardEditorLayout>
				<Card>
					<Card.Header>
						<Card.Title>Clip unavailable</Card.Title>
					</Card.Header>
					<Card.Content>
						<Link href='/dashboard/clips'>Return to clip inventory</Link>
					</Card.Content>
				</Card>
			</DashboardEditorLayout>
		);
	return (
		<DashboardEditorLayout>
			<ControlledModal isOpen={navGuard.active} onClose={navGuard.reject}>
				<Modal.Header>
					<Modal.Heading>Leave without saving?</Modal.Heading>
				</Modal.Header>
				<Modal.Body>Your channel layout has unsaved changes.</Modal.Body>
				<Modal.Footer>
					<Button variant='secondary' onPress={navGuard.reject}>
						Keep editing
					</Button>
					<Button variant='danger' onPress={navGuard.accept}>
						Leave editor
					</Button>
				</Modal.Footer>
			</ControlledModal>
			<Card className='w-full'>
				<Card.Header className='flex flex-row flex-wrap items-center justify-between gap-3'>
					<div className='flex w-full min-w-0 items-center gap-3 sm:w-auto'>
						<Button
							isIconOnly
							aria-label='Back to clip details'
							variant='tertiary'
							onPress={() => {
								router.push(`/dashboard/clips/${encodeURIComponent(ids[0])}`);
							}}
						>
							<IconArrowLeft />
						</Button>
						<div className='min-w-0'>
							<Card.Title className='line-clamp-2'>{clip.title || "Untitled clip"}</Card.Title>
							<Card.Description>{ids.length === 1 ? "Portrait export" : `${ids.length} clips selected`}</Card.Description>
						</div>
					</div>
					<div className='flex flex-wrap items-center gap-2'>
						<Button
							variant='secondary'
							isDisabled={!loaded || !dirty || saving}
							isPending={saving}
							onPress={async () => {
								setSaving(true);
								try {
									const r = await saveClipLayout(creatorId, layout);
									notify({ title: r.ok ? "Channel layout saved" : "Layout could not be saved", description: r.ok ? "Use this layout for your next clips." : "Your edits are kept. Check your access and try again.", color: r.ok ? "success" : "danger" });
									if (r.ok && latest.current === layout) setDirty(false);
								} catch {
									notify({ title: "Layout could not be saved", color: "danger" });
								} finally {
									setSaving(false);
								}
							}}
						>
							Save channel layout
						</Button>
						<fieldset disabled={!loaded} className='contents'>
							<ClipExport creatorId={creatorId} clipIds={ids} scope={`${creatorId}:${ids.join(",")}:${JSON.stringify(layout)}`} format={ids.length === 1 ? "mp4" : "zip"} layout={layout} />
						</fieldset>
					</div>
				</Card.Header>
				<Card.Content>
					<fieldset disabled={!loaded} aria-busy={!loaded} className='space-y-6'>
						<div className='flex flex-wrap items-center justify-between gap-3'>
							<div className='flex gap-2'>
								<Button
									size='sm'
									variant={layout.mode === "full" ? "primary" : "secondary"}
									onPress={() => {
										setSelected("gameplay");
										change({ ...layout, mode: "full" });
									}}
								>
									Full
								</Button>
								<Button size='sm' variant={layout.mode === "stacked" ? "primary" : "secondary"} onPress={() => change({ ...layout, mode: "stacked" })}>
									Stacked
								</Button>
							</div>
							<Button size='sm' variant='ghost' onPress={() => change(defaultClipLayout)}>
								<IconRefresh className='size-4' /> Reset layout
							</Button>
						</div>
						<div className='grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_200px]'>
							<section aria-label='Source crop editor' className='min-w-0 space-y-3'>
								<h2 className='text-sm font-medium'>Original clip</h2>
								<div data-source-stage className='relative aspect-video overflow-hidden rounded-xl bg-black'>
									{source ? (
										<video
											ref={video}
											src={source}
											crossOrigin='anonymous'
											playsInline
											preload='auto'
											className='h-full w-full object-contain'
											onLoadedMetadata={() => {
												setDuration(video.current?.duration || 0);
											}}
											onTimeUpdate={() => setTime(video.current?.currentTime || 0)}
											onPlay={() => setPlaying(true)}
											onPause={() => setPlaying(false)}
											onError={() => {
												setSource(null);
												notify({ title: "Source clip could not be loaded", description: "Retry to keep editing.", color: "danger" });
											}}
										/>
									) : (
										<div className='flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm text-muted'>
											<p role='status'>{source === undefined ? "Loading clip…" : "Clip preview unavailable"}</p>
											{source === null ? (
												<Button
													variant='secondary'
													onPress={() => {
														setSource(undefined);
														setRetry((v) => v + 1);
													}}
												>
													Retry preview
												</Button>
											) : null}
										</div>
									)}
									{source
										? (["gameplay", ...(layout.mode === "stacked" ? ["camera"] : [])] as const).map((kind) => {
												const c = layout[kind as "gameplay" | "camera"];
												return (
													<div key={kind} className='pointer-events-none absolute' style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%` }}>
														<Button
															aria-label={`Move ${kind} crop`}
															variant='ghost'
															className={`pointer-events-auto h-full w-full min-w-0 touch-none items-start justify-start rounded-none border-2 p-1 text-xs ${kind === "camera" ? "border-warning text-warning" : "border-accent text-accent"}`}
															onPointerDown={(e) => drag(e, kind as "gameplay" | "camera")}
															onKeyDown={(e) => {
																if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
																e.preventDefault();
																setSelected(kind as "gameplay" | "camera");
																const step = e.shiftKey ? 0.05 : 0.01;
																change({ ...layout, [kind]: { ...c, x: clamp(c.x + (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0), 0, 1 - c.w), y: clamp(c.y + (e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0), 0, 1 - c.h) } });
															}}
														>
															<span className='rounded bg-black/70 px-1 text-white'>{kind === "gameplay" ? "Gameplay" : "Camera"}</span>
														</Button>
														<Button isIconOnly size='sm' variant='secondary' className='pointer-events-auto absolute right-0 bottom-0 size-6 min-w-0 touch-none rounded-none' aria-label={`Resize ${kind} crop`} onPointerDown={(e) => drag(e, kind as "gameplay" | "camera", true)} onPress={() => setSelected(kind as "gameplay" | "camera")}>
															<IconArrowsDiagonal className='size-3' aria-hidden='true' />
														</Button>
													</div>
												);
											})
										: null}
								</div>
								<div className='flex items-center gap-3'>
									<Button
										isIconOnly
										variant='secondary'
										aria-label={playing ? "Pause clip" : "Play clip"}
										isDisabled={!source}
										onPress={() => {
											const v = video.current;
											if (v?.paused) void v.play().catch(() => notify({ title: "Playback could not start", color: "warning" }));
											else v?.pause();
										}}
									>
										{playing ? <IconPlayerPause /> : <IconPlayerPlay />}
									</Button>
									<div className='min-w-0 flex-1'>
										<Range
											label='Preview position'
											value={time}
											max={Math.max(1, duration)}
											onChange={(v) => {
												if (video.current) video.current.currentTime = v;
											}}
										/>
									</div>
								</div>
								<p className='text-xs text-muted'>Drag a crop to move it. Use its corner to resize, or use the controls below. Arrow keys move the focused crop.</p>
							</section>
							<section aria-label='Portrait preview' className='mx-auto w-full max-w-[200px] space-y-3'>
								<h2 className='text-sm font-medium'>Portrait 9:16</h2>
								<canvas ref={canvas} width={720} height={1280} role='img' aria-label='Rendered portrait preview' className='aspect-[9/16] w-full rounded-xl bg-black' />
							</section>
						</div>
						<div className='grid gap-6 md:grid-cols-2'>
							<section className='space-y-4' aria-label='Crop settings'>
								<div className='flex flex-wrap items-center gap-2'>
									<h2 className='mr-2 font-semibold'>Source crops</h2>
									<Button size='sm' variant={selected === "gameplay" ? "primary" : "secondary"} onPress={() => setSelected("gameplay")}>
										Gameplay
									</Button>
									<Button size='sm' isDisabled={layout.mode === "full"} variant={selected === "camera" ? "primary" : "secondary"} onPress={() => setSelected("camera")}>
										Camera
									</Button>
								</div>
								<div className='grid grid-cols-2 gap-4'>
									{(["x", "y", "w", "h"] as const).map((key, i) => (
										<Range key={key} label={["Horizontal position", "Vertical position", "Crop width", "Crop height"][i]} value={layout[selected][key] * 100} min={key === "w" || key === "h" ? 2 : 0} onChange={(v) => updateCrop({ [key]: v / 100 })} />
									))}
								</div>
								{layout.mode === "stacked" ? <Range label='Camera height (%)' value={layout.cameraShare * 100} min={20} max={50} onChange={(v) => change({ ...layout, cameraShare: v / 100 })} /> : null}
							</section>
							<section aria-label='Text layers' className='space-y-4'>
								<h2 className='font-semibold'>Text and credits</h2>
								{(["channel", "title", "clipper"] as const).map((field) => {
									const layer = layout.textLayers.find((l) => l.field === field);
									return (
										<div key={field} className='space-y-3'>
											<Checkbox isSelected={Boolean(layer)} onChange={(enabled) => change({ ...layout, textLayers: enabled ? [...layout.textLayers, { field, x: 5, y: field === "title" ? 80 : field === "clipper" ? 88 : 5, size: 24 }] : layout.textLayers.filter((l) => l.field !== field) })}>
												<Checkbox.Content>
													<Checkbox.Control>
														<Checkbox.Indicator />
													</Checkbox.Control>
													<Label>{field === "channel" ? "Channel name" : field === "title" ? "Clip title" : "Clipped by"}</Label>
												</Checkbox.Content>
											</Checkbox>
											{layer ? (
												<div className='grid grid-cols-3 gap-3'>
													{(["x", "y", "size"] as const).map((key) => (
														<Range key={key} label={key === "x" ? "Left (%)" : key === "y" ? "Top (%)" : "Text size"} value={layer[key]} min={key === "size" ? 16 : 0} max={key === "size" ? 48 : key === "x" ? 85 : 90} onChange={(v) => change({ ...layout, textLayers: layout.textLayers.map((l) => (l.field === field ? { ...l, [key]: v } : l)) })} />
													))}
												</div>
											) : null}
										</div>
									);
								})}
							</section>
						</div>
						{ids.length > 1 ? <p className='text-sm text-muted'>{ids.length} clips selected. Preview shows the first clip; this layout applies to each clip. Titles and credits use each clip’s own metadata. Check clips with different camera positions before exporting.</p> : null}
					</fieldset>
				</Card.Content>
			</Card>
		</DashboardEditorLayout>
	);
}
