"use client";
import { Button } from "@heroui/react";
import { useEffect, useLayoutEffect, useRef, type PointerEvent, type RefObject } from "react";
import { resizeCompositionRect, snapCompositionRect, type CompositionRect } from "@lib/clipComposition";
import type { CSSProperties } from "react";
type Corner = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";
type Guides = { x?: number; y?: number };
export default function CompositionBox({
	rect,
	label,
	selected,
	stage,
	dimensions,
	ratio,
	onSelect,
	onChange,
	snap = false,
	targets = [],
	onGuides,
	onRemove,
	color = "var(--accent)",
	showLabel = true,
	showOutline = false,
}: {
	rect: CompositionRect;
	label: string;
	selected: boolean;
	stage: RefObject<HTMLDivElement | null>;
	dimensions: { width: number; height: number };
	ratio?: (event: PointerEvent<HTMLElement>, start: CompositionRect) => number | undefined;
	onSelect: () => void;
	onChange: (rect: CompositionRect) => void;
	snap?: boolean;
	targets?: CompositionRect[];
	onGuides?: (guides: Guides) => void;
	onRemove?: () => void;
	color?: string;
	showLabel?: boolean;
	showOutline?: boolean;
}) {
	const drag = useRef<{ pointerId: number; x: number; y: number; rect: CompositionRect; corner?: Corner } | null>(null);
	const begin = (event: PointerEvent<HTMLElement>, corner?: Corner) => {
		if (event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();
		onSelect();
		drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, rect: { ...rect }, corner };
		event.currentTarget.setPointerCapture(event.pointerId);
	};
	const move = (event: PointerEvent<HTMLElement>) => {
		const start = drag.current;
		if (!start || event.pointerId !== start.pointerId) return;
		const bounds = stage.current?.getBoundingClientRect();
		if (!bounds?.width || !bounds.height) return;
		if (event.pointerType !== "touch" && (event.buttons & 1) === 0) {
			end();
			return;
		}
		const dx = (event.clientX - start.x) / bounds.width,
			dy = (event.clientY - start.y) / bounds.height;
		let next = start.corner ? resizeCompositionRect(start.rect, dx, dy, start.corner, ratio?.(event, start.rect)) : { ...start.rect, x: Math.max(0, Math.min(1 - start.rect.w, start.rect.x + dx)), y: Math.max(0, Math.min(1 - start.rect.h, start.rect.y + dy)) };
		if (snap && start.corner && !event.altKey && !event.ctrlKey) {
			let sx = dx,
				sy = dy;
			const guides: Guides = {};
			for (const axis of ["x", "y"] as const) {
				const horizontal = axis === "x",
					size = horizontal ? "w" : "h";
				if (!(horizontal ? /[we]/ : /[ns]/).test(start.corner)) continue;
				const low = start.corner.includes(horizontal ? "w" : "n");
				const edge = next[axis] + (low ? 0 : next[size]);
				const threshold = 8 / (horizontal ? bounds.width : bounds.height);
				const target = [0, 0.5, 1, ...targets.flatMap((r) => [r[axis], r[axis] + r[size] / 2, r[axis] + r[size]])].filter((n) => Math.abs(n - edge) <= threshold).sort((a, b) => Math.abs(a - edge) - Math.abs(b - edge))[0];
				if (target === undefined) continue;
				if (horizontal) sx += target - edge;
				else sy += target - edge;
				guides[axis] = target;
			}
			next = resizeCompositionRect(start.rect, sx, sy, start.corner, ratio?.(event, start.rect));
			onGuides?.(guides);
		} else if (snap && !event.altKey && !event.ctrlKey) {
			const result = snapCompositionRect(next, targets, 8 / bounds.width, 8 / bounds.height);
			next = result.rect;
			onGuides?.(result.guides);
		} else onGuides?.({});
		onChange(next);
	};
	const end = () => {
		if (!drag.current) return;
		drag.current = null;
		onGuides?.({});
	};
	const handlers = useRef({ move, end });
	useLayoutEffect(() => {
		handlers.current = { move, end };
	});
	useEffect(() => {
		const move = (event: globalThis.PointerEvent) => handlers.current.move(event as unknown as PointerEvent<HTMLElement>);
		const end = (event: Event) => {
			if ("pointerId" in event && drag.current && event.pointerId !== drag.current.pointerId) return;
			handlers.current.end();
		};
		window.addEventListener("pointermove", move, true);
		window.addEventListener("pointerup", end, true);
		window.addEventListener("pointercancel", end, true);
		window.addEventListener("blur", end);
		return () => {
			window.removeEventListener("pointermove", move, true);
			window.removeEventListener("pointerup", end, true);
			window.removeEventListener("pointercancel", end, true);
			window.removeEventListener("blur", end);
		};
	}, []);
	const pointer = { onLostPointerCapture: end };
	return (
		<div className={`absolute isolate border-2 ${selected || showOutline ? "opacity-100" : "border-transparent"}`} style={{ "--layer-color": color, borderColor: selected || showOutline ? color : "transparent", left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` } as CSSProperties}>
			<Button
				{...pointer}
				aria-label={label}
				variant='ghost'
				onPress={onSelect}
				onPointerDownCapture={(e) => begin(e)}
				onKeyDown={(e) => {
					const step = e.shiftKey ? 10 : 1;
					const dx = e.key === "ArrowRight" ? step / dimensions.width : e.key === "ArrowLeft" ? -step / dimensions.width : 0,
						dy = e.key === "ArrowDown" ? step / dimensions.height : e.key === "ArrowUp" ? -step / dimensions.height : 0;
					if (dx || dy) {
						e.preventDefault();
						onChange({ ...rect, x: Number(Math.max(0, Math.min(1 - rect.w, rect.x + dx)).toFixed(6)), y: Number(Math.max(0, Math.min(1 - rect.h, rect.y + dy)).toFixed(6)) });
					} else if ((e.key === "Delete" || e.key === "Backspace") && onRemove) {
						e.preventDefault();
						onRemove();
					}
				}}
				className='absolute inset-0 h-full min-h-0 w-full min-w-0 touch-none cursor-move rounded-none bg-transparent p-0 hover:bg-white/5'
			/>
			{selected ? (
				<>
					{showLabel ? <span className='pointer-events-none absolute left-0 top-0 max-w-full truncate bg-[var(--layer-color)] px-1 text-xs text-black'>{label}</span> : null}
					{(["n", "s", "e", "w", "nw", "ne", "sw", "se"] as const).map((corner) => {
						const edge = corner.length === 1;
						const position = edge ? (corner === "n" ? "inset-x-3 -top-1.5 h-3 w-auto cursor-ns-resize" : corner === "s" ? "inset-x-3 -bottom-1.5 h-3 w-auto cursor-ns-resize" : corner === "w" ? "inset-y-3 -left-1.5 w-3 h-auto cursor-ew-resize" : "inset-y-3 -right-1.5 w-3 h-auto cursor-ew-resize") : `${corner.includes("n") ? "-top-3" : "-bottom-3"} ${corner.includes("w") ? "-left-3" : "-right-3"} ${corner === "nw" || corner === "se" ? "cursor-nwse-resize" : "cursor-nesw-resize"}`;
						const name = `${corner.includes("n") ? "top" : corner.includes("s") ? "bottom" : ""} ${corner.includes("w") ? "left" : corner.includes("e") ? "right" : ""}`.trim();
						return (
							<Button key={corner} {...pointer} aria-label={`Resize ${label} ${name}`} variant='ghost' onPointerDownCapture={(e) => begin(e, corner)} className={`absolute z-10 size-6 min-h-0 min-w-0 touch-none rounded-none bg-transparent p-0 shadow-none hover:bg-transparent data-[hovered=true]:bg-transparent data-[pressed=true]:bg-transparent ${position}`}>
								{!edge ? <span className='size-2 border border-white bg-[var(--layer-color)]' /> : null}
							</Button>
						);
					})}
				</>
			) : null}
		</div>
	);
}
