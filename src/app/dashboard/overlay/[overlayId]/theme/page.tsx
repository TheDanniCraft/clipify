"use client";

import { validateAuth } from "@actions/auth";
import { getOverlay, getOverlayOwnerPlan, saveOverlay } from "@actions/database";
import ChatwootData from "@components/chatwootData";
import DashboardNavbar from "@components/dashboardNavbar";
import UpgradeModal from "@components/upgradeModal";
import { getTrialDaysLeft, isReverseTrialActive } from "@lib/featureAccess";
import { AuthenticatedUser, Overlay, Plan } from "@types";
import { addToast, Avatar, Button, Card, CardBody, CardHeader, Divider, Input, NumberInput, Popover, PopoverContent, PopoverTrigger, Select, SelectItem, Slider, Spinner, Tab, Tabs, useDisclosure } from "@heroui/react";
import { IconArrowLeft, IconCrown, IconDeviceFloppy, IconPalette } from "@tabler/icons-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const FONT_URL_DELIMITER = "||url||";
const systemFontOptions = [
	{ key: "system-ui", label: "System UI" },
	{ key: "Segoe UI, Arial, sans-serif", label: "Windows UI" },
	{ key: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif", label: "Apple UI" },
	{ key: "ui-monospace, SFMono-Regular, Menlo, monospace", label: "Monospace" },
];
type FontMode = "website" | "system" | "google";
type DragBlockedReason = "touch" | "narrow";
const OBS_OVERLAY_SCALE = 2;
const THEME_DEFAULTS = {
	overlayInfoFadeOutSeconds: 6,
	showChannelInfo: true,
	showClipInfo: true,
	showTimer: false,
	showProgressBar: false,
	themeFontFamily: "inherit",
	themeTextColor: "#FFFFFF",
	themeAccentColor: "#7C3AED",
	themeBackgroundColor: "rgba(10,10,10,0.65)",
	progressBarStartColor: "#26018E",
	progressBarEndColor: "#8D42F9",
	borderSize: 0,
	borderRadius: 10,
	effectScanlines: false,
	effectStatic: false,
	effectCrt: false,
	channelInfoX: 0,
	channelInfoY: 0,
	clipInfoX: 100,
	clipInfoY: 100,
	timerX: 88,
	timerY: 70,
} as const;

type DragTarget = "channel" | "clip" | "timer";

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function parseThemeFontSetting(value?: string) {
	const raw = (value ?? "").trim();
	if (!raw) return { fontFamily: "inherit", fontUrl: "" };
	if (raw.includes(FONT_URL_DELIMITER)) {
		const [family, url] = raw.split(FONT_URL_DELIMITER);
		return {
			fontFamily: family?.trim() || "inherit",
			fontUrl: url?.trim() || "",
		};
	}
	return { fontFamily: raw, fontUrl: "" };
}

function encodeThemeFontSetting(fontFamily: string, fontUrl?: string) {
	const family = (fontFamily || "inherit").trim();
	const url = (fontUrl || "").trim();
	return url ? `${family}${FONT_URL_DELIMITER}${url}` : family;
}

function buildGoogleFontUrl(fontFamily: string) {
	const family = fontFamily.trim().replace(/^['"]|['"]$/g, "");
	if (!family) return "";
	const encoded = family
		.split(",")[0]
		.trim()
		.replace(/\s+/g, "+");
	return `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;600;700&display=swap`;
}

function extractPrimaryFontName(fontFamily: string) {
	return fontFamily
		.split(",")[0]
		?.trim()
		.replace(/^['"]|['"]$/g, "");
}

function getFontMode(fontFamily: string, fontUrl: string): FontMode {
	if (!fontFamily || fontFamily === "inherit") return "website";
	if (fontUrl && fontUrl.includes("fonts.googleapis.com")) return "google";
	if (!fontUrl && systemFontOptions.some((opt) => opt.key === fontFamily)) return "system";
	return fontUrl ? "google" : "website";
}

type HSLA = { h: number; s: number; l: number; a: number };

function normalizeHue(value: number) {
	const wrapped = value % 360;
	return wrapped < 0 ? wrapped + 360 : wrapped;
}

function componentToHex(value: number) {
	return Math.round(clamp(value, 0, 255))
		.toString(16)
		.padStart(2, "0");
}

function hslaToCss(value: HSLA, allowAlpha: boolean) {
	const h = Math.round(normalizeHue(value.h));
	const s = Math.round(clamp(value.s, 0, 100));
	const l = Math.round(clamp(value.l, 0, 100));
	const a = clamp(value.a, 0, 1);
	const rgb = hslToRgb(h, s, l);
	if (allowAlpha && a < 1) return `hsla(${h}, ${s}%, ${l}%, ${a.toFixed(2)})`;
	return `#${componentToHex(rgb.r)}${componentToHex(rgb.g)}${componentToHex(rgb.b)}`;
}

function rgbToHex(r: number, g: number, b: number) {
	return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

function parseHexColor(raw: string) {
	const hex = raw.replace("#", "").trim();
	if (!/^[0-9a-f]+$/i.test(hex)) return null;
	if (hex.length === 3 || hex.length === 4) {
		const [r, g, b, a] = hex.split("");
		return {
			r: Number.parseInt(`${r}${r}`, 16),
			g: Number.parseInt(`${g}${g}`, 16),
			b: Number.parseInt(`${b}${b}`, 16),
			a: a ? Number.parseInt(`${a}${a}`, 16) / 255 : 1,
		};
	}
	if (hex.length === 6 || hex.length === 8) {
		return {
			r: Number.parseInt(hex.slice(0, 2), 16),
			g: Number.parseInt(hex.slice(2, 4), 16),
			b: Number.parseInt(hex.slice(4, 6), 16),
			a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
		};
	}
	return null;
}

function hslToRgb(h: number, s: number, l: number) {
	const sat = clamp(s, 0, 100) / 100;
	const light = clamp(l, 0, 100) / 100;
	const c = (1 - Math.abs(2 * light - 1)) * sat;
	const hh = normalizeHue(h) / 60;
	const x = c * (1 - Math.abs((hh % 2) - 1));
	let r = 0;
	let g = 0;
	let b = 0;

	if (hh >= 0 && hh < 1) {
		r = c;
		g = x;
	} else if (hh >= 1 && hh < 2) {
		r = x;
		g = c;
	} else if (hh >= 2 && hh < 3) {
		g = c;
		b = x;
	} else if (hh >= 3 && hh < 4) {
		g = x;
		b = c;
	} else if (hh >= 4 && hh < 5) {
		r = x;
		b = c;
	} else {
		r = c;
		b = x;
	}

	const m = light - c / 2;
	return {
		r: Math.round((r + m) * 255),
		g: Math.round((g + m) * 255),
		b: Math.round((b + m) * 255),
	};
}

function rgbToHsl(r: number, g: number, b: number, a = 1): HSLA {
	const rr = clamp(r, 0, 255) / 255;
	const gg = clamp(g, 0, 255) / 255;
	const bb = clamp(b, 0, 255) / 255;
	const max = Math.max(rr, gg, bb);
	const min = Math.min(rr, gg, bb);
	const delta = max - min;
	let h = 0;

	if (delta !== 0) {
		if (max === rr) h = ((gg - bb) / delta) % 6;
		else if (max === gg) h = (bb - rr) / delta + 2;
		else h = (rr - gg) / delta + 4;
	}

	const l = (max + min) / 2;
	const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

	return {
		h: normalizeHue(h * 60),
		s: s * 100,
		l: l * 100,
		a: clamp(a, 0, 1),
	};
}

function hslToHsv(h: number, s: number, l: number) {
	const sat = clamp(s, 0, 100) / 100;
	const light = clamp(l, 0, 100) / 100;
	const v = light + sat * Math.min(light, 1 - light);
	const nextS = v === 0 ? 0 : 2 * (1 - light / v);
	return {
		h: normalizeHue(h),
		s: clamp(nextS * 100, 0, 100),
		v: clamp(v * 100, 0, 100),
	};
}

function hsvToHsl(h: number, s: number, v: number) {
	const sat = clamp(s, 0, 100) / 100;
	const val = clamp(v, 0, 100) / 100;
	const l = val * (1 - sat / 2);
	const nextS = l === 0 || l === 1 ? 0 : (val - l) / Math.min(l, 1 - l);
	return {
		h: normalizeHue(h),
		s: clamp(nextS * 100, 0, 100),
		l: clamp(l * 100, 0, 100),
	};
}

function parseColorToHsla(rawValue: string): HSLA | null {
	const raw = (rawValue || "").trim();
	if (!raw) return null;

	if (raw.startsWith("#")) {
		const parsedHex = parseHexColor(raw);
		if (!parsedHex) return null;
		return rgbToHsl(parsedHex.r, parsedHex.g, parsedHex.b, parsedHex.a);
	}

	const rgbMatch = raw.match(/^rgba?\((.+)\)$/i);
	if (rgbMatch && rgbMatch[1]) {
		const parts = rgbMatch[1].split(",").map((part) => part.trim());
		if (parts.length >= 3) {
			const r = Number.parseFloat(parts[0] || "0");
			const g = Number.parseFloat(parts[1] || "0");
			const b = Number.parseFloat(parts[2] || "0");
			const a = parts.length >= 4 ? Number.parseFloat(parts[3] || "1") : 1;
			if ([r, g, b, a].every(Number.isFinite)) return rgbToHsl(r, g, b, a);
		}
	}

	const hslMatch = raw.match(/^hsla?\(\s*([0-9.]+)(?:deg)?\s*,\s*([0-9.]+)%\s*,\s*([0-9.]+)%(?:\s*,\s*([0-9.]+))?\s*\)$/i);
	if (hslMatch) {
		const h = Number.parseFloat(hslMatch[1] || "0");
		const s = Number.parseFloat(hslMatch[2] || "0");
		const l = Number.parseFloat(hslMatch[3] || "0");
		const a = hslMatch[4] ? Number.parseFloat(hslMatch[4]) : 1;
		if ([h, s, l, a].every(Number.isFinite)) return { h: normalizeHue(h), s: clamp(s, 0, 100), l: clamp(l, 0, 100), a: clamp(a, 0, 1) };
	}

	return null;
}

function ThemeColorInput({ label, value, onChange, defaultValue, allowAlpha }: { label: string; value: string; onChange: (value: string) => void; defaultValue: string; allowAlpha?: boolean }) {
	const svRef = useRef<HTMLDivElement | null>(null);
	const hueRef = useRef<HTMLDivElement | null>(null);
	const alphaRef = useRef<HTMLDivElement | null>(null);
	const parsedDefault = useMemo(() => parseColorToHsla(defaultValue) ?? { h: 260, s: 65, l: 52, a: 1 }, [defaultValue]);
	const parsed = useMemo(() => parseColorToHsla(value) ?? parsedDefault, [parsedDefault, value]);
	const hsv = useMemo(() => hslToHsv(parsed.h, parsed.s, parsed.l), [parsed.h, parsed.l, parsed.s]);
	const rgb = useMemo(() => hslToRgb(parsed.h, parsed.s, parsed.l), [parsed.h, parsed.l, parsed.s]);
	const hexValue = useMemo(() => rgbToHex(rgb.r, rgb.g, rgb.b).toUpperCase(), [rgb.b, rgb.g, rgb.r]);
	const preview = hslaToCss(parsed, true);
	const [hexDraft, setHexDraft] = useState(hexValue);
	const svMarkerLeft = clamp(hsv.s, 2, 98);
	const svMarkerTop = clamp(100 - hsv.v, 2, 98);
	const hueMarkerLeft = clamp((hsv.h / 360) * 100, 1, 99);
	const alphaMarkerLeft = clamp(parsed.a * 100, 1, 99);

	useEffect(() => {
		setHexDraft(hexValue);
	}, [hexValue]);

	const updateFromHsv = (patch: Partial<{ h: number; s: number; v: number; a: number }>) => {
		const nextHsv = {
			h: hsv.h,
			s: hsv.s,
			v: hsv.v,
			...patch,
		};
		const nextHsl = hsvToHsl(nextHsv.h, nextHsv.s, nextHsv.v);
		onChange(
			hslaToCss(
				{
					h: nextHsl.h,
					s: nextHsl.s,
					l: nextHsl.l,
					a: patch.a ?? parsed.a,
				},
				!!allowAlpha,
			),
		);
	};

	const startPointerDrag = (event: React.PointerEvent<HTMLElement>, onMove: (clientX: number, clientY: number) => void) => {
		event.preventDefault();
		onMove(event.clientX, event.clientY);
		const move = (nextEvent: PointerEvent) => onMove(nextEvent.clientX, nextEvent.clientY);
		const stop = () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", stop);
			window.removeEventListener("pointercancel", stop);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", stop);
		window.addEventListener("pointercancel", stop);
	};

	const updateSvFromPointer = (clientX: number, clientY: number) => {
		const node = svRef.current;
		if (!node) return;
		const rect = node.getBoundingClientRect();
		const s = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
		const v = clamp(100 - ((clientY - rect.top) / rect.height) * 100, 0, 100);
		updateFromHsv({ s, v });
	};

	const updateHueFromPointer = (clientX: number) => {
		const node = hueRef.current;
		if (!node) return;
		const rect = node.getBoundingClientRect();
		const h = clamp(((clientX - rect.left) / rect.width) * 360, 0, 360);
		updateFromHsv({ h });
	};

	const updateAlphaFromPointer = (clientX: number) => {
		const node = alphaRef.current;
		if (!node) return;
		const rect = node.getBoundingClientRect();
		const a = clamp((clientX - rect.left) / rect.width, 0, 1);
		updateFromHsv({ a });
	};

	const commitHexDraft = () => {
		const normalized = hexDraft.trim().startsWith("#") ? hexDraft.trim() : `#${hexDraft.trim()}`;
		const parsedHex = parseHexColor(normalized);
		if (!parsedHex) {
			setHexDraft(hexValue);
			return;
		}
		const nextHsl = rgbToHsl(parsedHex.r, parsedHex.g, parsedHex.b, parsed.a);
		onChange(hslaToCss({ h: nextHsl.h, s: nextHsl.s, l: nextHsl.l, a: parsed.a }, !!allowAlpha));
	};

	return (
		<Input
			type='text'
			label={label}
			value={value}
			onValueChange={onChange}
			endContent={
				<Popover placement='bottom-end'>
					<PopoverTrigger>
						<button type='button' className='h-7 w-7 rounded-md border border-default-300 transition-transform hover:scale-105' style={{ background: preview }} aria-label={`Pick ${label}`} />
					</PopoverTrigger>
					<PopoverContent className='p-3'>
						<div className='w-[260px] flex flex-col gap-3'>
							<div className='text-xs text-default-500 flex items-center gap-1'>
								<IconPalette className='h-3.5 w-3.5' />
								<span>{label}</span>
							</div>
							<div
								ref={svRef}
								className='relative h-[138px] rounded-xl border border-default-200 cursor-crosshair overflow-hidden'
								style={{
									background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${Math.round(hsv.h)}, 100%, 50%)`,
								}}
								onPointerDown={(event) => startPointerDrag(event, updateSvFromPointer)}
							>
								<div
									className='absolute h-3 w-3 rounded-full border-2 border-white -translate-x-1/2 -translate-y-1/2 pointer-events-none'
									style={{
										left: `${svMarkerLeft}%`,
										top: `${svMarkerTop}%`,
										boxShadow: "0 0 0 1px rgba(0,0,0,0.85)",
									}}
								/>
							</div>
							<div ref={hueRef} className='relative h-3 rounded-full border border-default-200 overflow-hidden cursor-pointer' onPointerDown={(event) => startPointerDrag(event, (x) => updateHueFromPointer(x))}>
								<div className='absolute inset-0 bg-[linear-gradient(90deg,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)]' />
								<div className='absolute top-1/2 h-4 w-2 rounded-full border border-white bg-zinc-900 -translate-y-1/2 -translate-x-1/2 pointer-events-none' style={{ left: `${hueMarkerLeft}%` }} />
							</div>
							{allowAlpha ? (
								<div ref={alphaRef} className='relative h-3 rounded-full border border-default-200 overflow-hidden cursor-pointer' onPointerDown={(event) => startPointerDrag(event, (x) => updateAlphaFromPointer(x))}>
									<div className='absolute inset-0 bg-[linear-gradient(45deg,#d4d4d8_25%,transparent_25%,transparent_50%,#d4d4d8_50%,#d4d4d8_75%,transparent_75%,transparent)] bg-[length:10px_10px]' />
									<div className='absolute inset-0' style={{ background: `linear-gradient(90deg, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0), rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1))` }} />
									<div className='absolute top-1/2 h-4 w-2 rounded-full border border-white bg-zinc-900 -translate-y-1/2 -translate-x-1/2 pointer-events-none' style={{ left: `${alphaMarkerLeft}%` }} />
								</div>
							) : null}
							<div className='grid grid-cols-[56px_minmax(0,1fr)_72px] gap-2'>
								<div className='h-8 rounded-lg border border-default-200 bg-content2 flex items-center justify-center text-xs'>Hex</div>
								<Input
									size='sm'
									value={hexDraft}
									onValueChange={setHexDraft}
									onBlur={commitHexDraft}
									onKeyDown={(event) => {
										if (event.key === "Enter") {
											event.preventDefault();
											commitHexDraft();
										}
									}}
								/>
								<Input size='sm' value={`${Math.round(parsed.a * 100)}%`} isReadOnly />
							</div>
							<Button size='sm' variant='light' onPress={() => onChange(defaultValue)}>
								Reset to default
							</Button>
						</div>
					</PopoverContent>
				</Popover>
			}
		/>
	);
}

function OverlayStylePreview({ overlay, canDrag, onMove, streamerAvatar, dragBlockedReason }: { overlay: Overlay; canDrag: boolean; onMove: (target: DragTarget, x: number, y: number) => void; streamerAvatar?: string; dragBlockedReason: DragBlockedReason | null }) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const channelRef = useRef<HTMLDivElement | null>(null);
	const clipRef = useRef<HTMLDivElement | null>(null);
	const timerRef = useRef<HTMLDivElement | null>(null);
	const [drag, setDrag] = useState<{ target: DragTarget; offsetX: number; offsetY: number } | null>(null);
	const runtimeOverlayScale = OBS_OVERLAY_SCALE;
	const { fontFamily: resolvedThemeFontFamily } = useMemo(() => parseThemeFontSetting(overlay.themeFontFamily), [overlay.themeFontFamily]);

	const themeStyle = useMemo(
		() => ({
			color: overlay.themeTextColor || "#FFFFFF",
			backgroundColor: overlay.themeBackgroundColor || "rgba(10,10,10,0.65)",
			borderColor: overlay.themeAccentColor || "#7C3AED",
			borderStyle: "solid" as const,
			borderWidth: `${Math.max(0, overlay.borderSize ?? 0)}px`,
			borderRadius: `${Math.max(0, overlay.borderRadius ?? 10)}px`,
			fontFamily: resolvedThemeFontFamily || "inherit",
		}),
		[overlay.borderRadius, overlay.borderSize, overlay.themeAccentColor, overlay.themeBackgroundColor, overlay.themeTextColor, resolvedThemeFontFamily],
	);
	const timerPos = useMemo(
		() => ({
			x: clamp(overlay.timerX ?? 88, 0, 100),
			y: clamp(overlay.timerY ?? 70, 0, 100),
		}),
		[overlay.timerX, overlay.timerY],
	);

	useEffect(() => {
		if (!drag || !canDrag) return;

		const onPointerMove = (event: PointerEvent) => {
			const container = containerRef.current;
			if (!container) return;
			const rect = container.getBoundingClientRect();
			const targetRef = drag.target === "channel" ? channelRef.current : drag.target === "clip" ? clipRef.current : timerRef.current;
			const scale = runtimeOverlayScale;
			const targetWidth = (targetRef?.offsetWidth ?? 0) * scale;
			const targetHeight = (targetRef?.offsetHeight ?? 0) * scale;

			const leftPx = event.clientX - rect.left - drag.offsetX;
			const topPx = event.clientY - rect.top - drag.offsetY;
			const centerXPx = leftPx + targetWidth / 2;
			const shouldAnchorRight = centerXPx > rect.width / 2;
			const rawLeftX = (leftPx / rect.width) * 100;
			const rawRightX = ((leftPx + targetWidth) / rect.width) * 100;
			const centerYPx = topPx + targetHeight / 2;
			const shouldAnchorBottom = centerYPx > rect.height / 2;
			const rawTopY = (topPx / rect.height) * 100;
			const rawBottomY = ((topPx + targetHeight) / rect.height) * 100;
			const widthPct = (targetWidth / rect.width) * 100;
			const heightPct = (targetHeight / rect.height) * 100;
			const maxXLeft = 100 - widthPct;
			const minXRight = widthPct;
			const maxYTop = 100 - heightPct;
			const minYBottom = heightPct;
			const nextX = shouldAnchorRight ? clamp(rawRightX, minXRight, 100) : clamp(rawLeftX, 0, Math.max(0, maxXLeft));
			const nextY = shouldAnchorBottom ? clamp(rawBottomY, minYBottom, 100) : clamp(rawTopY, 0, Math.max(0, maxYTop));

			onMove(drag.target, Math.round(nextX), Math.round(nextY));
		};

		const onPointerUp = () => setDrag(null);

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerUp);

		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerUp);
		};
	}, [canDrag, drag, onMove, runtimeOverlayScale]);

	return (
		<div className='w-full'>
			<div className='mb-2 text-xs text-default-500'>
				{canDrag
					? "Drag overlay elements to position them."
					: dragBlockedReason === "narrow"
						? "Drag and drop needs a wider viewport. Increase browser width or use desktop."
						: "Drag and drop is only supported on desktop. Switch to a desktop browser."}
			</div>
			<div ref={containerRef} className='relative w-full aspect-video rounded-xl border border-default-200 overflow-hidden bg-[linear-gradient(140deg,#0B1220,#1E293B)]'>
				<div className='absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.45),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(56,189,248,0.35),transparent_45%)]' />

				{overlay.effectScanlines && <div className='pointer-events-none absolute inset-0 z-[5] bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0.03)_1px,transparent_2px,transparent_4px)]' />}
				{overlay.effectStatic && <div className='pointer-events-none absolute inset-0 z-[5] animate-pulse bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.05),transparent_35%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.04),transparent_40%)]' />}
				{overlay.effectCrt && <div className='pointer-events-none absolute inset-0 z-[6] bg-[radial-gradient(circle_at_center,transparent_52%,rgba(0,0,0,0.38)_100%),linear-gradient(90deg,rgba(255,0,0,0.04),rgba(0,255,255,0.04))] mix-blend-screen' />}

				{overlay.showChannelInfo && (
					<div
						ref={channelRef}
						className={`absolute z-10 w-fit p-2 shadow-lg backdrop-blur-sm ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed"}`}
						style={{ ...(overlay.channelInfoX > 50 ? { right: `${100 - overlay.channelInfoX}%` } : { left: `${overlay.channelInfoX}%` }), ...(overlay.channelInfoY > 50 ? { bottom: `${100 - overlay.channelInfoY}%` } : { top: `${overlay.channelInfoY}%` }), ...themeStyle }}
						onPointerDown={(event) => {
							if (!canDrag) return;
							event.preventDefault();
							const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
							setDrag({ target: "channel", offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top });
						}}
					>
						<div className={`flex items-center ${overlay.channelInfoX > 50 ? "flex-row-reverse" : ""}`}>
							<Avatar size='md' src={streamerAvatar} />
							<div className={`text-xs ${overlay.channelInfoX > 50 ? "mr-2 text-right" : "ml-2 text-left"}`}>
								<div className='font-semibold'>TheDanniCraft</div>
								<div className='opacity-80'>Playing Just Chatting</div>
							</div>
						</div>
					</div>
				)}

				{overlay.showClipInfo && (
					<div
						ref={clipRef}
						className={`absolute z-10 p-2 shadow-lg backdrop-blur-sm w-fit max-w-[min(360px,42vw)] ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed"}`}
						style={{
							...(overlay.clipInfoX > 50 ? { right: `${100 - overlay.clipInfoX}%` } : { left: `${overlay.clipInfoX}%` }),
							...(overlay.clipInfoY > 50 ? { bottom: `${100 - overlay.clipInfoY}%` } : { top: `${overlay.clipInfoY}%` }),
							...themeStyle,
						}}
						onPointerDown={(event) => {
							if (!canDrag) return;
							event.preventDefault();
							const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
							setDrag({ target: "clip", offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top });
						}}
					>
						<div className={`text-xs break-normal ${overlay.clipInfoX > 50 ? "text-right" : "text-left"}`}>
							<div className='font-bold'>Insane comeback in ranked</div>
							<div className='opacity-80 mt-1'>clipped by bestviewer123</div>
						</div>
					</div>
				)}

				{overlay.showTimer && (
					<div
						ref={timerRef}
						className={`absolute z-10 shadow-lg backdrop-blur-sm h-12 w-12 min-h-12 min-w-12 aspect-square flex items-center justify-center text-sm font-bold leading-none tabular-nums ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed"}`}
						style={{ ...(timerPos.x > 50 ? { right: `${100 - timerPos.x}%` } : { left: `${timerPos.x}%` }), ...(timerPos.y > 50 ? { bottom: `${100 - timerPos.y}%` } : { top: `${timerPos.y}%` }), ...themeStyle, borderRadius: "9999px", padding: 0 }}
						onPointerDown={(event) => {
							if (!canDrag) return;
							event.preventDefault();
							const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
							setDrag({ target: "timer", offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top });
						}}
					>
						18
					</div>
				)}

				{overlay.showProgressBar && (
					<div className='absolute left-0 right-0 bottom-0 h-2 sm:h-3 overflow-hidden' style={{ backgroundColor: "rgba(0,0,0,0.35)" }}>
						<div className='h-full' style={{ width: "52%", background: `linear-gradient(90deg, ${overlay.progressBarStartColor || "#26018E"}, ${overlay.progressBarEndColor || "#8D42F9"})` }} />
					</div>
				)}
			</div>
		</div>
	);
}

export default function OverlayStylePage() {
	const router = useRouter();
	const { overlayId } = useParams() as { overlayId: string };

	const [overlay, setOverlay] = useState<Overlay | null>(null);
	const [baseOverlay, setBaseOverlay] = useState<Overlay | null>(null);
	const [user, setUser] = useState<AuthenticatedUser>();
	const [ownerPlan, setOwnerPlan] = useState<Plan | null>(null);
	const [dragSupported, setDragSupported] = useState(true);
	const [dragBlockedReason, setDragBlockedReason] = useState<DragBlockedReason | null>(null);
	const { isOpen: isUpgradeOpen, onOpen: onUpgradeOpen, onOpenChange: onUpgradeOpenChange } = useDisclosure();

	useEffect(() => {
		async function checkAuth() {
			const authedUser = await validateAuth();
			if (!authedUser) {
				router.push("/logout");
				return;
			}
			setUser(authedUser);
		}

		checkAuth();
	}, [router]);

	useEffect(() => {
		async function fetchOverlayData() {
			if (!overlayId) return;
			const fetchedOverlay = await getOverlay(overlayId);
			if (!fetchedOverlay) return;
			setOverlay(fetchedOverlay);
			setBaseOverlay(fetchedOverlay);
			const plan = await getOverlayOwnerPlan(fetchedOverlay.id);
			setOwnerPlan(plan);
		}

		fetchOverlayData();
	}, [overlayId]);

	useEffect(() => {
		function updateDragSupport() {
			if (typeof window === "undefined") return;
			const MIN_EDITOR_WIDTH = 1100;
			const finePointer = window.matchMedia("(pointer: fine)").matches;
			const wideEnough = window.innerWidth >= MIN_EDITOR_WIDTH;

			if (!finePointer) {
				setDragSupported(false);
				setDragBlockedReason("touch");
				return;
			}
			if (!wideEnough) {
				setDragSupported(false);
				setDragBlockedReason("narrow");
				return;
			}

			setDragSupported(true);
			setDragBlockedReason(null);
		}

		updateDragSupport();
		window.addEventListener("resize", updateDragSupport);
		return () => window.removeEventListener("resize", updateDragSupport);
	}, []);

	const parsedThemeFont = parseThemeFontSetting(overlay?.themeFontFamily);
	const currentFontMode = getFontMode(parsedThemeFont.fontFamily, parsedThemeFont.fontUrl);
	const googleFontFamily = extractPrimaryFontName(parsedThemeFont.fontFamily) || "Poppins";
	const selectedComponents = useMemo(() => {
		const components: string[] = [];
		if (overlay?.showChannelInfo) components.push("channel");
		if (overlay?.showClipInfo) components.push("clip");
		if (overlay?.showTimer) components.push("timer");
		if (overlay?.showProgressBar) components.push("progress");
		return new Set(components);
	}, [overlay?.showChannelInfo, overlay?.showClipInfo, overlay?.showTimer, overlay?.showProgressBar]);
	const selectedEffects = useMemo(() => {
		const effects: string[] = [];
		if (overlay?.effectScanlines) effects.push("scanlines");
		if (overlay?.effectStatic) effects.push("static");
		if (overlay?.effectCrt) effects.push("crt");
		return new Set(effects);
	}, [overlay?.effectScanlines, overlay?.effectStatic, overlay?.effectCrt]);

	if (!overlay || !user) {
		return (
			<div className='flex items-center justify-center h-screen w-full'>
				<Spinner label='Loading overlay style editor' />
			</div>
		);
	}

	const ownerHasAdvancedAccess = ownerPlan === Plan.Pro;
	const inTrial = isReverseTrialActive(user);
	const trialDaysLeft = getTrialDaysLeft(user);

	const isFormDirty = JSON.stringify(overlay) !== JSON.stringify(baseOverlay);

	function handleResetThemeDefaults() {
		setOverlay((prev) => {
			if (!prev) return prev;
			return {
				...prev,
				...THEME_DEFAULTS,
			};
		});
		addToast({ title: "Theme reset", description: "Save style to persist these changes.", color: "default" });
	}

	async function handleSave() {
		if (!overlay) return;
		addToast({ title: "Saving...", color: "default" });
		await saveOverlay(overlay.id, {
			playerVolume: overlay.playerVolume,
			overlayInfoFadeOutSeconds: overlay.overlayInfoFadeOutSeconds,
			showChannelInfo: overlay.showChannelInfo,
			showClipInfo: overlay.showClipInfo,
			showTimer: overlay.showTimer,
			showProgressBar: overlay.showProgressBar,
			themeFontFamily: overlay.themeFontFamily,
			themeTextColor: overlay.themeTextColor,
			themeAccentColor: overlay.themeAccentColor,
			themeBackgroundColor: overlay.themeBackgroundColor,
			progressBarStartColor: overlay.progressBarStartColor,
			progressBarEndColor: overlay.progressBarEndColor,
			borderSize: overlay.borderSize,
			borderRadius: overlay.borderRadius,
			effectScanlines: overlay.effectScanlines,
			effectStatic: overlay.effectStatic,
			effectCrt: overlay.effectCrt,
			channelInfoX: overlay.channelInfoX,
			channelInfoY: overlay.channelInfoY,
			clipInfoX: overlay.clipInfoX,
			clipInfoY: overlay.clipInfoY,
			timerX: overlay.timerX,
			timerY: overlay.timerY,
		});
		setBaseOverlay(overlay);
		addToast({ title: "Style saved", description: "Overlay style has been updated.", color: "success" });
	}

	return (
		<>
			{parsedThemeFont.fontUrl ? <link rel='stylesheet' href={parsedThemeFont.fontUrl} /> : null}
			<DashboardNavbar user={user} title='Overlay Style' tagline='Customize look and layout'>
				<ChatwootData user={user} overlay={overlay} />

				<div className='w-full p-4 md:p-6'>
					<Card>
						<CardHeader className='flex items-center justify-between gap-2'>
							<Button isIconOnly variant='light' aria-label='Back to Overlay Settings' onPress={() => router.push(`/dashboard/overlay/${overlay.id}`)}>
								<IconArrowLeft />
							</Button>
							<div className='flex items-center gap-2'>
								<Button variant='flat' onPress={handleResetThemeDefaults}>
									Reset Theme
								</Button>
								<Button color='primary' startContent={<IconDeviceFloppy />} onPress={handleSave} isDisabled={!isFormDirty}>
									Save Style
								</Button>
							</div>
						</CardHeader>
						<CardBody className='flex flex-col gap-4'>
							<div>
								{!dragSupported && (
									<Card className='mb-3 border border-warning-200 bg-warning-50'>
										<CardBody className='text-warning-800 text-sm'>
											{dragBlockedReason === "narrow"
												? "Drag & drop needs a wider viewport. Expand your browser width or switch to desktop for layout editing."
												: "Drag & drop positioning is not supported on mobile or touch-only devices. Switch to a desktop browser for layout editing."}
										</CardBody>
									</Card>
								)}
								{ownerPlan === Plan.Free && !ownerHasAdvancedAccess ? (
									<Card className='bg-warning-50 border border-warning-200 mb-2'>
										<CardBody>
											<div className='flex items-center gap-2 mb-1'>
												<IconCrown className='text-warning-500' />
												<span className='text-warning-800 font-semibold text-base'>Pro Feature Locked</span>
											</div>
											<p className='text-sm text-warning-700'>Theme Studio and drag-and-drop layout are available on Pro.</p>
											<Button color='warning' variant='shadow' onPress={onUpgradeOpen} className='mt-3 w-full font-semibold'>
												Upgrade to Pro
											</Button>
											<p className='text-xs text-warning-600 text-center mt-2'>{inTrial ? `Trial active: ${trialDaysLeft <= 1 ? "ends today." : `${trialDaysLeft} days left.`}` : "Start Pro now. Cancel anytime."}</p>
										</CardBody>
									</Card>
								) : null}

								<div
									style={{
										filter: ownerPlan === Plan.Free && !ownerHasAdvancedAccess ? "blur(1.5px)" : "none",
										pointerEvents: ownerPlan === Plan.Free && !ownerHasAdvancedAccess ? "none" : "auto",
									}}
								>
									<OverlayStylePreview
										overlay={overlay}
										canDrag={dragSupported}
										streamerAvatar={user.avatar}
										dragBlockedReason={dragBlockedReason}
										onMove={(target, x, y) => {
											setOverlay((prev) => {
												if (!prev) return prev;
												if (target === "channel") return { ...prev, channelInfoX: x, channelInfoY: y };
												if (target === "timer") return { ...prev, timerX: x, timerY: y };
												return { ...prev, clipInfoX: x, clipInfoY: y };
											});
										}}
									/>
								</div>
							</div>
							<Divider />
							<div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
								<Slider minValue={0} maxValue={100} step={1} value={overlay.playerVolume} label='Player Volume' showTooltip onChange={(value) => setOverlay({ ...overlay, playerVolume: Number(Array.isArray(value) ? value[0] : value) })} />
								<Slider minValue={0} maxValue={30} step={1} value={overlay.overlayInfoFadeOutSeconds ?? 6} label='Overlay Fade Out (seconds)' showTooltip onChange={(value) => setOverlay({ ...overlay, overlayInfoFadeOutSeconds: Number(Array.isArray(value) ? value[0] : value) })} />
								<Select
									label='Enabled Components'
									selectionMode='multiple'
									selectedKeys={selectedComponents}
									onSelectionChange={(keys) => {
										if (keys === "all") return;
										const selected = new Set(Array.from(keys).map((key) => String(key)));
										setOverlay({
											...overlay,
											showChannelInfo: selected.has("channel"),
											showClipInfo: selected.has("clip"),
											showTimer: selected.has("timer"),
											showProgressBar: selected.has("progress"),
										});
									}}
								>
									<SelectItem key='channel'>Channel Info</SelectItem>
									<SelectItem key='clip'>Clip Info</SelectItem>
									<SelectItem key='timer'>Timer</SelectItem>
									<SelectItem key='progress'>Progress Bar</SelectItem>
								</Select>
								<Select
									label='Visual Effects'
									selectionMode='multiple'
									selectedKeys={selectedEffects}
									onSelectionChange={(keys) => {
										if (keys === "all") return;
										const selected = new Set(Array.from(keys).map((key) => String(key)));
										setOverlay({
											...overlay,
											effectScanlines: selected.has("scanlines"),
											effectStatic: selected.has("static"),
											effectCrt: selected.has("crt"),
										});
									}}
								>
									<SelectItem key='scanlines'>Scanlines</SelectItem>
									<SelectItem key='static'>Static</SelectItem>
									<SelectItem key='crt'>CRT (Old TV)</SelectItem>
								</Select>
								<Card className='lg:col-span-2 border border-default-200/80'>
									<CardHeader className='pb-1'>
										<div>
											<div className='text-sm font-semibold'>Typography</div>
											<div className='text-xs text-default-500'>Pick a font source, then fine-tune only what you need.</div>
										</div>
									</CardHeader>
									<CardBody className='pt-1 flex flex-col gap-3'>
										<Tabs
											selectedKey={currentFontMode}
											onSelectionChange={(key) => {
												const mode = key as FontMode;
												if (mode === "website") {
													setOverlay({ ...overlay, themeFontFamily: "inherit" });
													return;
												}
												if (mode === "system") {
													setOverlay({ ...overlay, themeFontFamily: encodeThemeFontSetting(systemFontOptions[0]?.key || "system-ui", "") });
													return;
												}
												if (mode === "google") {
													const nextFamily = extractPrimaryFontName(parsedThemeFont.fontFamily) || "Poppins";
													setOverlay({ ...overlay, themeFontFamily: encodeThemeFontSetting(`${nextFamily}, sans-serif`, buildGoogleFontUrl(nextFamily)) });
													return;
												}
												setOverlay({ ...overlay, themeFontFamily: "inherit" });
											}}
											variant='underlined'
											color='primary'
											aria-label='Typography Source'
										>
											<Tab key='website' title='Website' />
											<Tab key='system' title='System' />
											<Tab key='google' title='Google' />
										</Tabs>

										{currentFontMode === "website" && (
											<p className='text-xs text-default-500'>Using the same default font stack as the Clipify website.</p>
										)}

										{currentFontMode === "system" && (
											<Select
												selectedKeys={[systemFontOptions.some((opt) => opt.key === parsedThemeFont.fontFamily) ? parsedThemeFont.fontFamily : systemFontOptions[0]?.key || "system-ui"]}
												onSelectionChange={(value) => setOverlay({ ...overlay, themeFontFamily: encodeThemeFontSetting((value.currentKey as string) || "system-ui", "") })}
												label='System Font'
											>
												{systemFontOptions.map((font) => (
													<SelectItem key={font.key}>{font.label}</SelectItem>
												))}
											</Select>
										)}

										{currentFontMode === "google" && (
											<div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
												<Input
													type='text'
													label='Google Font Family'
													value={googleFontFamily}
													onValueChange={(value) => {
														const family = (value || "Poppins").trim();
														setOverlay({ ...overlay, themeFontFamily: encodeThemeFontSetting(`${family}, sans-serif`, buildGoogleFontUrl(family)) });
													}}
													description='Example: Poppins, Space Grotesk, Roboto Slab'
												/>
												<Input type='text' label='Google CSS URL' value={parsedThemeFont.fontUrl} isReadOnly />
											</div>
										)}

									</CardBody>
								</Card>
								<ThemeColorInput label='Text Color' value={overlay.themeTextColor} defaultValue='#FFFFFF' onChange={(value) => setOverlay({ ...overlay, themeTextColor: value })} />
								<ThemeColorInput label='Background Color' value={overlay.themeBackgroundColor} defaultValue='rgba(10,10,10,0.65)' allowAlpha onChange={(value) => setOverlay({ ...overlay, themeBackgroundColor: value })} />
								<div className='lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3'>
									<ThemeColorInput label='Progress Gradient Start' value={overlay.progressBarStartColor} defaultValue='#26018E' onChange={(value) => setOverlay({ ...overlay, progressBarStartColor: value })} />
									<ThemeColorInput label='Progress Gradient End' value={overlay.progressBarEndColor} defaultValue='#8D42F9' onChange={(value) => setOverlay({ ...overlay, progressBarEndColor: value })} />
								</div>
								<NumberInput minValue={0} maxValue={32} value={overlay.borderSize} onValueChange={(value) => setOverlay({ ...overlay, borderSize: Number(value) })} label='Border Size' />
								<NumberInput minValue={0} maxValue={48} value={overlay.borderRadius} onValueChange={(value) => setOverlay({ ...overlay, borderRadius: Number(value) })} label='Border Radius' />
							</div>
						</CardBody>
					</Card>
				</div>
			</DashboardNavbar>
			<UpgradeModal isOpen={isUpgradeOpen} onOpenChange={onUpgradeOpenChange} user={user} title='Upgrade to unlock Theme Studio' source='upgrade_modal' feature='advanced_filters' />
		</>
	);
}
