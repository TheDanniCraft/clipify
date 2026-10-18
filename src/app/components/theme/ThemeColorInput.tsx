"use client";
import { useState, useEffect, useMemo, useCallback, useRef, useSyncExternalStore } from "react";
import { Button, ColorArea, ColorField, ColorPicker, ColorSlider, ColorSwatch, ColorSwatchPicker, ListBox, Select, Label, parseColor, type ColorSpace, type ColorChannel } from "@heroui/react";
const RECENT_THEME_COLORS_KEY = "clipify:overlay-theme-recent-colors";

const RECENT_THEME_COLORS_EVENT = "clipify:overlay-theme-recent-colors-change";

const MAX_RECENT_THEME_COLORS = 6;

const COLOR_CHANNELS_BY_SPACE: Record<ColorSpace, ColorChannel[]> = {
	hsb: ["hue", "saturation", "brightness"],
	hsl: ["hue", "saturation", "lightness"],
	rgb: ["red", "green", "blue"],
};

function readRecentThemeColors() {
	if (typeof window === "undefined") return [];
	try {
		const stored = JSON.parse(window.localStorage.getItem(RECENT_THEME_COLORS_KEY) ?? "[]");
		return Array.isArray(stored) ? stored.filter((color): color is string => typeof color === "string").slice(0, MAX_RECENT_THEME_COLORS) : [];
	} catch {
		return [];
	}
}

function useRecentThemeColors() {
	const serializedColors = useSyncExternalStore(
		(callback) => {
			window.addEventListener(RECENT_THEME_COLORS_EVENT, callback);
			return () => window.removeEventListener(RECENT_THEME_COLORS_EVENT, callback);
		},
		() => window.localStorage.getItem(RECENT_THEME_COLORS_KEY) ?? "[]",
		() => "[]",
	);
	const recentColors = useMemo(() => {
		try {
			const parsed = JSON.parse(serializedColors);
			return Array.isArray(parsed) ? parsed.filter((color): color is string => typeof color === "string").slice(0, MAX_RECENT_THEME_COLORS) : [];
		} catch {
			return [];
		}
	}, [serializedColors]);

	const rememberColor = useCallback((value: string) => {
		if (typeof window === "undefined") return;
		let normalized: string;
		try {
			normalized = parseColor(value).toString("rgba");
		} catch {
			return;
		}
		const next = [normalized, ...readRecentThemeColors().filter((color) => color.toLowerCase() !== normalized.toLowerCase())].slice(0, MAX_RECENT_THEME_COLORS);
		window.localStorage.setItem(RECENT_THEME_COLORS_KEY, JSON.stringify(next));
		window.dispatchEvent(new CustomEvent<string[]>(RECENT_THEME_COLORS_EVENT, { detail: next }));
	}, []);

	return { recentColors, rememberColor };
}

export function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
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
	const h = normalizeHue(value.h);
	const s = clamp(value.s, 0, 100);
	const l = clamp(value.l, 0, 100);
	const a = clamp(value.a, 0, 1);
	const rgb = hslToRgb(h, s, l);
	if (allowAlpha && a < 1) return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
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

export default function ThemeColorInput({ label, value, onChange, defaultValue, allowAlpha }: { label: string; value: string; onChange: (value: string) => void; defaultValue: string; allowAlpha?: boolean }) {
	const [colorSpace, setColorSpace] = useState<ColorSpace>("rgb");
	const { recentColors, rememberColor } = useRecentThemeColors();
	const parsedDefault = useMemo(() => parseColorToHsla(defaultValue) ?? { h: 260, s: 65, l: 52, a: 1 }, [defaultValue]);
	const parsed = useMemo(() => parseColorToHsla(value) ?? parsedDefault, [parsedDefault, value]);
	const hsv = useMemo(() => hslToHsv(parsed.h, parsed.s, parsed.l), [parsed.h, parsed.l, parsed.s]);
	const normalizedValue = useMemo(() => {
		const normalizedHsl = hsvToHsl(hsv.h, hsv.s, hsv.v);
		return hslaToCss({ ...normalizedHsl, a: parsed.a }, !!allowAlpha);
	}, [allowAlpha, hsv.h, hsv.s, hsv.v, parsed.a]);
	const color = useMemo(() => parseColor(normalizedValue), [normalizedValue]);
	const latestColorRef = useRef(normalizedValue);
	const swatches = useMemo(() => Array.from(new Set([defaultValue, "#7C3AED", "#9146FF", "#FFFFFF", "#000000", ...recentColors].map((entry) => entry.trim()).filter(Boolean))), [defaultValue, recentColors]);

	useEffect(() => {
		latestColorRef.current = normalizedValue;
	}, [normalizedValue]);

	const handleColorChange = (nextColor: Parameters<NonNullable<React.ComponentProps<typeof ColorPicker>["onChange"]>>[0]) => {
		const nextValue = nextColor.toString(allowAlpha ? "rgba" : "hex");
		latestColorRef.current = nextValue;
		onChange(nextValue);
	};

	return (
		<ColorPicker value={color} onChange={handleColorChange}>
			<ColorField fullWidth>
				<Label>{label}</Label>
				<ColorField.Group fullWidth variant='secondary'>
					<ColorField.Input onBlur={() => queueMicrotask(() => rememberColor(latestColorRef.current))} />
					<ColorField.Suffix className='pe-1'>
						<ColorPicker.Trigger className='p-1' aria-label={`Pick ${label}`}>
							<ColorSwatch size='xs' />
						</ColorPicker.Trigger>
					</ColorField.Suffix>
				</ColorField.Group>
			</ColorField>
			<ColorPicker.Popover className='max-w-62 gap-2' placement='bottom end'>
				<ColorArea aria-label={`${label} color area`} className='max-w-full' colorSpace='hsb' xChannel='saturation' yChannel='brightness' onChangeEnd={(nextColor) => rememberColor(nextColor.toString("rgba"))}>
					<ColorArea.Thumb />
				</ColorArea>
				<ColorSlider aria-label={`${label} hue`} channel='hue' className='gap-1 px-1' colorSpace='hsb' onChangeEnd={(nextColor) => rememberColor(nextColor.toString("rgba"))}>
					<Label>Hue</Label>
					<ColorSlider.Output className='text-muted' />
					<ColorSlider.Track>
						<ColorSlider.Thumb />
					</ColorSlider.Track>
				</ColorSlider>
				<Select aria-label='Color space' value={colorSpace} variant='secondary' onChange={(nextSpace) => setColorSpace(nextSpace as ColorSpace)}>
					<Select.Trigger>
						<Select.Value className='uppercase' />
						<Select.Indicator />
					</Select.Trigger>
					<Select.Popover>
						<ListBox>
							{Object.keys(COLOR_CHANNELS_BY_SPACE).map((space) => (
								<ListBox.Item key={space} className='uppercase' id={space} textValue={space}>
									{space}
									<ListBox.ItemIndicator />
								</ListBox.Item>
							))}
						</ListBox>
					</Select.Popover>
				</Select>
				<div className='grid w-full grid-cols-3 items-center gap-2'>
					{COLOR_CHANNELS_BY_SPACE[colorSpace].map((channel) => (
						<ColorField key={channel} aria-label={channel} channel={channel} colorSpace={colorSpace}>
							<ColorField.Group variant='secondary'>
								<ColorField.Input onBlur={() => queueMicrotask(() => rememberColor(latestColorRef.current))} />
							</ColorField.Group>
						</ColorField>
					))}
				</div>
				{allowAlpha ? (
					<ColorSlider aria-label={`${label} opacity`} channel='alpha' className='gap-1 px-1' colorSpace='rgb' onChangeEnd={(nextColor) => rememberColor(nextColor.toString("rgba"))}>
						<Label>Opacity</Label>
						<ColorSlider.Output className='text-muted' />
						<ColorSlider.Track>
							<ColorSlider.Thumb />
						</ColorSlider.Track>
					</ColorSlider>
				) : null}
				<ColorSwatchPicker
					className='justify-center px-1'
					size='xs'
					onChange={(nextColor) => {
						handleColorChange(nextColor);
						rememberColor(nextColor.toString("rgba"));
					}}
				>
					{swatches.map((swatch) => (
						<ColorSwatchPicker.Item key={swatch} color={swatch}>
							<ColorSwatchPicker.Swatch />
						</ColorSwatchPicker.Item>
					))}
				</ColorSwatchPicker>
				<Button className='w-full' size='sm' variant='tertiary' onPress={() => onChange(defaultValue)}>
					Reset to default
				</Button>
			</ColorPicker.Popover>
		</ColorPicker>
	);
}
