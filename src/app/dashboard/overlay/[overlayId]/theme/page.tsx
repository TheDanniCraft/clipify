"use client";

import { validateAuth } from "@actions/auth";
import { getOverlay, getOverlayOwnerPlan, saveOverlay } from "@actions/database";
import ChatwootData from "@components/chatwootData";
import DashboardNavbar from "@components/dashboardNavbar";
import UpgradeModal from "@components/upgradeModal";
import { getTrialDaysLeft, isReverseTrialActive } from "@lib/featureAccess";
import { AuthenticatedUser, Overlay, Plan } from "@types";
import { addToast, Avatar, Button, Card, CardBody, CardHeader, Divider, Input, Popover, PopoverContent, PopoverTrigger, Select, SelectItem, Slider, Spinner, Tab, Tabs, useDisclosure } from "@heroui/react";
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
	timerX: 100,
	timerY: 0,
	channelScale: 100,
	clipScale: 100,
	timerScale: 100,
} as const;

type DragTarget = "channel" | "clip" | "timer";
type ResizeHandle = "tl" | "tr" | "bl" | "br";
type HorizontalAnchor = "left" | "right";
type VerticalAnchor = "top" | "bottom";

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
	const preview = hslaToCss(parsed, true);
	const svMarkerLeft = clamp(hsv.s, 2, 98);
	const svMarkerTop = clamp(100 - hsv.v, 2, 98);
	const hueMarkerLeft = clamp((hsv.h / 360) * 100, 1, 99);
	const alphaMarkerLeft = clamp(parsed.a * 100, 1, 99);

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
								<div className='rounded-xl border border-default-200 bg-content2/70 p-2'>
									<div className='flex items-center justify-between text-[11px] text-default-500 mb-2'>
										<span>Opacity</span>
										<span>{Math.round(parsed.a * 100)}%</span>
									</div>
									<div ref={alphaRef} className='relative h-5 rounded-lg border border-default-300 overflow-hidden cursor-pointer' onPointerDown={(event) => startPointerDrag(event, (x) => updateAlphaFromPointer(x))}>
										<div className='absolute inset-0 bg-[linear-gradient(45deg,#d4d4d8_25%,transparent_25%,transparent_50%,#d4d4d8_50%,#d4d4d8_75%,transparent_75%,transparent)] bg-[length:10px_10px]' />
										<div className='absolute inset-0' style={{ background: `linear-gradient(90deg, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0), rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1))` }} />
										<div className='absolute top-1/2 h-4 w-4 rounded-full border-2 border-white bg-zinc-900/90 -translate-y-1/2 -translate-x-1/2 pointer-events-none' style={{ left: `${alphaMarkerLeft}%`, boxShadow: "0 0 0 1px rgba(0,0,0,0.5)" }} />
									</div>
								</div>
							) : null}
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

function OverlayStylePreview({
	overlay,
	canDrag,
	onMove,
	onScaleChange,
	streamerAvatar,
	dragBlockedReason,
}: {
	overlay: Overlay;
	canDrag: boolean;
	onMove: (target: DragTarget, x: number, y: number) => void;
	onScaleChange: (target: DragTarget, scale: number) => void;
	streamerAvatar?: string;
	dragBlockedReason: DragBlockedReason | null;
}) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const channelRef = useRef<HTMLDivElement | null>(null);
	const clipRef = useRef<HTMLDivElement | null>(null);
	const timerRef = useRef<HTMLDivElement | null>(null);
	const [drag, setDrag] = useState<{ target: DragTarget; offsetX: number; offsetY: number; width: number; height: number; anchorX: HorizontalAnchor; anchorY: VerticalAnchor } | null>(null);
	const [resize, setResize] = useState<{ target: DragTarget; handle: ResizeHandle; startScale: number; startWidth: number; startHeight: number; fixedX: number; fixedY: number } | null>(null);
	const [selectedTarget, setSelectedTarget] = useState<DragTarget | null>(null);
	const channelScaleFactor = clamp((overlay.channelScale ?? 100) / 100, 0.5, 2.5);
	const clipScaleFactor = clamp((overlay.clipScale ?? 100) / 100, 0.5, 2.5);
	const timerScaleFactor = clamp((overlay.timerScale ?? 100) / 100, 0.5, 2.5);
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
			x: clamp(overlay.timerX ?? 100, 0, 100),
			y: clamp(overlay.timerY ?? 0, 0, 100),
		}),
		[overlay.timerX, overlay.timerY],
	);
	const channelAnchoredRight = drag?.target === "channel" ? drag.anchorX === "right" : overlay.channelInfoX > 50;
	const channelAnchoredBottom = drag?.target === "channel" ? drag.anchorY === "bottom" : overlay.channelInfoY > 50;
	const clipAnchoredRight = drag?.target === "clip" ? drag.anchorX === "right" : overlay.clipInfoX > 50;
	const clipAnchoredBottom = drag?.target === "clip" ? drag.anchorY === "bottom" : overlay.clipInfoY > 50;
	const timerAnchoredRight = drag?.target === "timer" ? drag.anchorX === "right" : timerPos.x > 50;
	const timerAnchoredBottom = drag?.target === "timer" ? drag.anchorY === "bottom" : timerPos.y > 50;
	const previewProgressBarHeight = 10;

	useEffect(() => {
		if (!drag || !canDrag || resize) return;

		const onPointerMove = (event: PointerEvent) => {
			const container = containerRef.current;
			if (!container) return;
			const rect = container.getBoundingClientRect();
			const targetWidth = drag.width;
			const targetHeight = drag.height;
			if (targetWidth <= 0 || targetHeight <= 0) return;

			const leftPx = clamp(event.clientX - rect.left - drag.offsetX, 0, Math.max(0, rect.width - targetWidth));
			const topPx = clamp(event.clientY - rect.top - drag.offsetY, 0, Math.max(0, rect.height - targetHeight));
			const rawLeftX = (leftPx / rect.width) * 100;
			const rawRightX = ((leftPx + targetWidth) / rect.width) * 100;
			const rawTopY = (topPx / rect.height) * 100;
			const rawBottomY = ((topPx + targetHeight) / rect.height) * 100;
			const widthPct = (targetWidth / rect.width) * 100;
			const heightPct = (targetHeight / rect.height) * 100;
			const nextX = drag.anchorX === "right" ? clamp(rawRightX, widthPct, 100) : clamp(rawLeftX, 0, Math.max(0, 100 - widthPct));
			const nextY = drag.anchorY === "bottom" ? clamp(rawBottomY, heightPct, 100) : clamp(rawTopY, 0, Math.max(0, 100 - heightPct));

			onMove(drag.target, Number(nextX.toFixed(2)), Number(nextY.toFixed(2)));
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
	}, [canDrag, drag, onMove, resize]);

	useEffect(() => {
		if (!resize || !canDrag) return;

		const onPointerMove = (event: PointerEvent) => {
			const container = containerRef.current;
			if (!container) return;
			const containerRect = container.getBoundingClientRect();
			const pointerX = event.clientX - containerRect.left;
			const pointerY = event.clientY - containerRect.top;

			let rawWidth = 0;
			let rawHeight = 0;
			if (resize.handle === "tl") {
				rawWidth = resize.fixedX - pointerX;
				rawHeight = resize.fixedY - pointerY;
			} else if (resize.handle === "tr") {
				rawWidth = pointerX - resize.fixedX;
				rawHeight = resize.fixedY - pointerY;
			} else if (resize.handle === "bl") {
				rawWidth = resize.fixedX - pointerX;
				rawHeight = pointerY - resize.fixedY;
			} else {
				rawWidth = pointerX - resize.fixedX;
				rawHeight = pointerY - resize.fixedY;
			}

			const baseWidth = Math.max(resize.startWidth, 1);
			const baseHeight = Math.max(resize.startHeight, 1);
			const projectedNumerator = rawWidth * baseWidth + rawHeight * baseHeight;
			const projectedDenominator = baseWidth * baseWidth + baseHeight * baseHeight;
			const projectedRatio = projectedDenominator > 0 ? projectedNumerator / projectedDenominator : 1;
			const minRatio = 50 / Math.max(resize.startScale, 1);
			const maxRatio = 250 / Math.max(resize.startScale, 1);
			const maxFitRatio = Math.min(containerRect.width / baseWidth, containerRect.height / baseHeight);
			const ratioUpperBound = Math.max(minRatio, Math.min(maxRatio, maxFitRatio));
			const ratio = clamp(projectedRatio, minRatio, ratioUpperBound);
			const nextScale = clamp(Math.round(resize.startScale * ratio), 50, 250);
			const appliedRatio = nextScale / Math.max(resize.startScale, 1);
			const nextWidth = resize.startWidth * appliedRatio;
			const nextHeight = resize.startHeight * appliedRatio;

			let nextLeft = 0;
			let nextTop = 0;
			if (resize.handle === "tl") {
				nextLeft = resize.fixedX - nextWidth;
				nextTop = resize.fixedY - nextHeight;
			} else if (resize.handle === "tr") {
				nextLeft = resize.fixedX;
				nextTop = resize.fixedY - nextHeight;
			} else if (resize.handle === "bl") {
				nextLeft = resize.fixedX - nextWidth;
				nextTop = resize.fixedY;
			} else {
				nextLeft = resize.fixedX;
				nextTop = resize.fixedY;
			}

			nextLeft = clamp(nextLeft, 0, Math.max(0, containerRect.width - nextWidth));
			nextTop = clamp(nextTop, 0, Math.max(0, containerRect.height - nextHeight));
			const centerXPx = nextLeft + nextWidth / 2;
			const centerYPx = nextTop + nextHeight / 2;
			const anchorRight = centerXPx > containerRect.width / 2;
			const anchorBottom = centerYPx > containerRect.height / 2;
			const rawLeftX = (nextLeft / containerRect.width) * 100;
			const rawRightX = ((nextLeft + nextWidth) / containerRect.width) * 100;
			const rawTopY = (nextTop / containerRect.height) * 100;
			const rawBottomY = ((nextTop + nextHeight) / containerRect.height) * 100;
			const widthPct = (nextWidth / containerRect.width) * 100;
			const heightPct = (nextHeight / containerRect.height) * 100;
			const nextX = anchorRight ? clamp(rawRightX, widthPct, 100) : clamp(rawLeftX, 0, Math.max(0, 100 - widthPct));
			const nextY = anchorBottom ? clamp(rawBottomY, heightPct, 100) : clamp(rawTopY, 0, Math.max(0, 100 - heightPct));

			onScaleChange(resize.target, nextScale);
			onMove(resize.target, Number(nextX.toFixed(2)), Number(nextY.toFixed(2)));
		};

		const onPointerUp = () => setResize(null);

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerUp);

		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerUp);
		};
	}, [canDrag, onMove, onScaleChange, resize]);

	useEffect(() => {
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node | null;
			if (!target) return;

			const container = containerRef.current;
			const channel = channelRef.current;
			const clip = clipRef.current;
			const timer = timerRef.current;
			const clickedOverlayElement = !!(channel?.contains(target) || clip?.contains(target) || timer?.contains(target));
			if (clickedOverlayElement) return;

			if (!container || !container.contains(target)) {
				setSelectedTarget(null);
				return;
			}

			setSelectedTarget(null);
		};

		window.addEventListener("pointerdown", onPointerDown);
		return () => window.removeEventListener("pointerdown", onPointerDown);
	}, []);

	useEffect(() => {
		if (!canDrag || !selectedTarget) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
			const active = document.activeElement as HTMLElement | null;
			if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return;
			event.preventDefault();

			const container = containerRef.current;
			if (!container) return;
			const targetRef = selectedTarget === "channel" ? channelRef.current : selectedTarget === "clip" ? clipRef.current : timerRef.current;
			if (!targetRef) return;

			const containerRect = container.getBoundingClientRect();
			const targetRect = targetRef.getBoundingClientRect();
			const step = event.shiftKey ? 10 : 2;
			const deltaX = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
			const deltaY = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
			const width = targetRect.width;
			const height = targetRect.height;
			const currentX = selectedTarget === "channel" ? overlay.channelInfoX : selectedTarget === "clip" ? overlay.clipInfoX : timerPos.x;
			const currentY = selectedTarget === "channel" ? overlay.channelInfoY : selectedTarget === "clip" ? overlay.clipInfoY : timerPos.y;
			const stepXPct = (step / Math.max(containerRect.width, 1)) * 100;
			const stepYPct = (step / Math.max(containerRect.height, 1)) * 100;
			const widthPct = (width / containerRect.width) * 100;
			const heightPct = (height / containerRect.height) * 100;
			const anchorRight = selectedTarget === "channel" ? channelAnchoredRight : selectedTarget === "clip" ? clipAnchoredRight : timerAnchoredRight;
			const anchorBottom = selectedTarget === "channel" ? channelAnchoredBottom : selectedTarget === "clip" ? clipAnchoredBottom : timerAnchoredBottom;
			const rawNextX = currentX + (deltaX > 0 ? stepXPct : deltaX < 0 ? -stepXPct : 0);
			const rawNextY = currentY + (deltaY > 0 ? stepYPct : deltaY < 0 ? -stepYPct : 0);
			const nextX = anchorRight ? clamp(rawNextX, widthPct, 100) : clamp(rawNextX, 0, Math.max(0, 100 - widthPct));
			const nextY = anchorBottom ? clamp(rawNextY, heightPct, 100) : clamp(rawNextY, 0, Math.max(0, 100 - heightPct));

			onMove(selectedTarget, Number(nextX.toFixed(2)), Number(nextY.toFixed(2)));
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [canDrag, channelAnchoredBottom, channelAnchoredRight, clipAnchoredBottom, clipAnchoredRight, onMove, overlay.channelInfoX, overlay.channelInfoY, overlay.clipInfoX, overlay.clipInfoY, selectedTarget, timerAnchoredBottom, timerAnchoredRight, timerPos.x, timerPos.y]);

	function startResize(target: DragTarget, handle: ResizeHandle, event: React.PointerEvent<HTMLElement>) {
		if (!canDrag) return;
		event.preventDefault();
		event.stopPropagation();
		const targetRef = target === "channel" ? channelRef.current : target === "clip" ? clipRef.current : timerRef.current;
		if (!targetRef) return;
		const container = containerRef.current;
		if (!container) return;
		const containerRect = container.getBoundingClientRect();
		const rect = targetRef.getBoundingClientRect();
		const startLeft = rect.left - containerRect.left;
		const startTop = rect.top - containerRect.top;
		const startRight = startLeft + rect.width;
		const startBottom = startTop + rect.height;
		let fixedX = startLeft;
		let fixedY = startTop;
		if (handle === "tl") {
			fixedX = startRight;
			fixedY = startBottom;
		} else if (handle === "tr") {
			fixedX = startLeft;
			fixedY = startBottom;
		} else if (handle === "bl") {
			fixedX = startRight;
			fixedY = startTop;
		}
		const startScale = target === "channel" ? overlay.channelScale ?? 100 : target === "clip" ? overlay.clipScale ?? 100 : overlay.timerScale ?? 100;
		setResize({
			target,
			handle,
			startScale,
			startWidth: rect.width,
			startHeight: rect.height,
			fixedX,
			fixedY,
		});
	}

	function renderResizeHandles(target: DragTarget) {
		if (!canDrag || selectedTarget !== target) return null;
		return (
			<>
				<button type='button' className='absolute -left-1 -top-1 h-3 w-3 rounded-full border border-red-700 bg-red-500 cursor-nwse-resize' onPointerDown={(event) => startResize(target, "tl", event)} aria-label={`Resize ${target} top left`} />
				<button type='button' className='absolute -right-1 -top-1 h-3 w-3 rounded-full border border-red-700 bg-red-500 cursor-nesw-resize' onPointerDown={(event) => startResize(target, "tr", event)} aria-label={`Resize ${target} top right`} />
				<button type='button' className='absolute -left-1 -bottom-1 h-3 w-3 rounded-full border border-red-700 bg-red-500 cursor-nesw-resize' onPointerDown={(event) => startResize(target, "bl", event)} aria-label={`Resize ${target} bottom left`} />
				<button type='button' className='absolute -right-1 -bottom-1 h-3 w-3 rounded-full border border-red-700 bg-red-500 cursor-nwse-resize' onPointerDown={(event) => startResize(target, "br", event)} aria-label={`Resize ${target} bottom right`} />
			</>
		);
	}

	return (
		<div className='w-full'>
			<div
				ref={containerRef}
				className='relative w-full aspect-video rounded-xl border border-default-200 overflow-hidden bg-[linear-gradient(140deg,#0B1220,#1E293B)]'
				onPointerDown={(event) => {
					if (event.target === event.currentTarget) setSelectedTarget(null);
				}}
			>
				<div className='pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.45),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(56,189,248,0.35),transparent_45%)]' />

				{overlay.effectScanlines && <div className='pointer-events-none absolute inset-0 z-[5] bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0.03)_1px,transparent_2px,transparent_4px)]' />}
				{overlay.effectStatic && <div className='pointer-events-none absolute inset-0 z-[5] animate-pulse bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.05),transparent_35%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.04),transparent_40%)]' />}
				{overlay.effectCrt && <div className='pointer-events-none absolute inset-0 z-[6] bg-[radial-gradient(circle_at_center,transparent_52%,rgba(0,0,0,0.38)_100%),linear-gradient(90deg,rgba(255,0,0,0.04),rgba(0,255,255,0.04))] mix-blend-screen' />}

				{overlay.showChannelInfo && (
					<div className='absolute z-10' style={{ left: `${overlay.channelInfoX}%`, top: `${overlay.channelInfoY}%` }}>
						<div className='inline-block' style={{ transform: `translate(${channelAnchoredRight ? "-100%" : "0"}, ${channelAnchoredBottom ? "-100%" : "0"})` }}>
							<div className='relative inline-block'>
								<div
									ref={channelRef}
									className={`relative w-fit p-2 shadow-lg backdrop-blur-sm ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed"} ${selectedTarget === "channel" ? "ring-2 ring-inset ring-red-500" : ""}`}
									style={{ transform: `scale(${channelScaleFactor})`, transformOrigin: `${channelAnchoredRight ? "right" : "left"} ${channelAnchoredBottom ? "bottom" : "top"}`, ...themeStyle }}
									onPointerDown={(event) => {
										if (!canDrag || resize) return;
										event.stopPropagation();
										event.preventDefault();
										setSelectedTarget("channel");
										const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
										setDrag({
											target: "channel",
											offsetX: event.clientX - rect.left,
											offsetY: event.clientY - rect.top,
											width: rect.width,
											height: rect.height,
											anchorX: overlay.channelInfoX > 50 ? "right" : "left",
											anchorY: overlay.channelInfoY > 50 ? "bottom" : "top",
										});
									}}
								>
									<div className={`flex items-center ${channelAnchoredRight ? "flex-row-reverse" : ""}`}>
										<Avatar size='md' src={streamerAvatar} />
										<div className={`text-xs ${channelAnchoredRight ? "mr-2 text-right" : "ml-2 text-left"}`}>
											<div className='font-semibold'>TheDanniCraft</div>
											<div className='opacity-80'>Playing Just Chatting</div>
										</div>
									</div>
								</div>
								{renderResizeHandles("channel")}
							</div>
						</div>
					</div>
				)}

				{overlay.showClipInfo && (
					<div className='absolute z-10' style={{ left: `${overlay.clipInfoX}%`, top: `${overlay.clipInfoY}%` }}>
						<div className='inline-block' style={{ transform: `translate(${clipAnchoredRight ? "-100%" : "0"}, ${clipAnchoredBottom ? "-100%" : "0"})` }}>
							<div className='relative inline-block'>
								<div
									ref={clipRef}
									className={`relative p-2 shadow-lg backdrop-blur-sm w-max max-w-[360px] ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed"} ${selectedTarget === "clip" ? "ring-2 ring-inset ring-red-500" : ""}`}
									style={{
										transform: `scale(${clipScaleFactor})`,
										transformOrigin: `${clipAnchoredRight ? "right" : "left"} ${clipAnchoredBottom ? "bottom" : "top"}`,
										...themeStyle,
									}}
									onPointerDown={(event) => {
										if (!canDrag || resize) return;
										event.stopPropagation();
										event.preventDefault();
										setSelectedTarget("clip");
										const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
										setDrag({
											target: "clip",
											offsetX: event.clientX - rect.left,
											offsetY: event.clientY - rect.top,
											width: rect.width,
											height: rect.height,
											anchorX: overlay.clipInfoX > 50 ? "right" : "left",
											anchorY: overlay.clipInfoY > 50 ? "bottom" : "top",
										});
									}}
								>
									<div className={`text-xs break-normal ${clipAnchoredRight ? "text-right" : "text-left"}`}>
										<div className='font-bold'>Insane comeback in ranked</div>
										<div className='opacity-80 mt-1'>clipped by bestviewer123</div>
									</div>
								</div>
								{renderResizeHandles("clip")}
							</div>
						</div>
					</div>
				)}

				{overlay.showTimer && (
					<div className='absolute z-10' style={{ left: `${timerPos.x}%`, top: `${timerPos.y}%` }}>
						<div className='inline-block' style={{ transform: `translate(${timerAnchoredRight ? "-100%" : "0"}, ${timerAnchoredBottom ? "-100%" : "0"})` }}>
							<div className='relative inline-block'>
								<div
									ref={timerRef}
									className={`relative shadow-lg backdrop-blur-sm h-12 w-12 min-h-12 min-w-12 aspect-square flex items-center justify-center text-sm font-bold leading-none tabular-nums ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed"} ${selectedTarget === "timer" ? "ring-2 ring-inset ring-red-500" : ""}`}
									style={{ transform: `scale(${timerScaleFactor})`, transformOrigin: `${timerAnchoredRight ? "right" : "left"} ${timerAnchoredBottom ? "bottom" : "top"}`, ...themeStyle, borderRadius: "9999px", padding: 0 }}
									onPointerDown={(event) => {
										if (!canDrag || resize) return;
										event.stopPropagation();
										event.preventDefault();
										setSelectedTarget("timer");
										const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
										setDrag({
											target: "timer",
											offsetX: event.clientX - rect.left,
											offsetY: event.clientY - rect.top,
											width: rect.width,
											height: rect.height,
											anchorX: timerPos.x > 50 ? "right" : "left",
											anchorY: timerPos.y > 50 ? "bottom" : "top",
										});
									}}
								>
									18
								</div>
								{renderResizeHandles("timer")}
							</div>
						</div>
					</div>
				)}

				{overlay.showProgressBar && (
					<div className='absolute left-0 right-0 bottom-0 overflow-hidden' style={{ backgroundColor: "rgba(0,0,0,0.35)", height: `${previewProgressBarHeight}px` }}>
						<div className='h-full' style={{ width: "52%", background: `linear-gradient(90deg, ${overlay.progressBarStartColor || "#26018E"}, ${overlay.progressBarEndColor || "#8D42F9"})` }} />
					</div>
				)}
			</div>
			<div className='mt-2 text-xs text-default-500'>
				{canDrag
					? "Drag overlay elements to position them. Use arrow keys to nudge selected items (Shift for larger steps)."
					: dragBlockedReason === "narrow"
						? "Drag and drop needs a wider viewport. Increase browser width or use desktop."
						: "Drag and drop is only supported on desktop. Switch to a desktop browser."}
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
			channelScale: overlay.channelScale,
			clipScale: overlay.clipScale,
			timerScale: overlay.timerScale,
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
										userSelect: ownerPlan === Plan.Free && !ownerHasAdvancedAccess ? "none" : "auto",
										WebkitUserSelect: ownerPlan === Plan.Free && !ownerHasAdvancedAccess ? "none" : "auto",
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
										onScaleChange={(target, scale) => {
											setOverlay((prev) => {
												if (!prev) return prev;
												if (target === "channel") return { ...prev, channelScale: scale };
												if (target === "timer") return { ...prev, timerScale: scale };
												return { ...prev, clipScale: scale };
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
							</div>
						</CardBody>
					</Card>
				</div>
			</DashboardNavbar>
			<UpgradeModal isOpen={isUpgradeOpen} onOpenChange={onUpgradeOpenChange} user={user} title='Upgrade to unlock Theme Studio' source='upgrade_modal' feature='advanced_filters' />
		</>
	);
}
