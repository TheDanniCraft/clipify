"use client";
import { Button } from "@heroui/react";
import { useRef, type PointerEvent, type RefObject } from "react";
import { resizeCompositionRect, snapCompositionRect, type CompositionRect } from "@lib/clipComposition";
import type { CSSProperties } from "react";
type Corner = "nw" | "ne" | "sw" | "se";
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
		const start = drag.current,
			bounds = stage.current?.getBoundingClientRect();
		if (!start || event.pointerId !== start.pointerId || !bounds?.width || !bounds.height) return;
		const dx = (event.clientX - start.x) / bounds.width,
			dy = (event.clientY - start.y) / bounds.height;
		let next = start.corner ? resizeCompositionRect(start.rect, dx, dy, start.corner, ratio?.(event, start.rect)) : { ...start.rect, x: Math.max(0, Math.min(1 - start.rect.w, start.rect.x + dx)), y: Math.max(0, Math.min(1 - start.rect.h, start.rect.y + dy)) };
		if (snap && !start.corner && !event.altKey) {
			const result = snapCompositionRect(next, targets, 6 / bounds.width, 6 / bounds.height);
			next = result.rect;
			onGuides?.(result.guides);
		} else onGuides?.({});
		onChange(next);
	};
	const end = () => {
		drag.current = null;
		onGuides?.({});
	};
	const pointer = { onPointerMove: move, onPointerUp: end, onPointerCancel: end, onLostPointerCapture: end };
	return (
		<div className={`absolute border-2 ${selected ? "opacity-100" : "opacity-70"}`} style={{ "--layer-color": color, borderColor: color, left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` } as CSSProperties}>
			<Button
				{...pointer}
				aria-label={label}
				variant='ghost'
				onPress={onSelect}
				onPointerDown={(e) => begin(e)}
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
				className='absolute inset-0 h-full min-h-0 w-full min-w-0 touch-none rounded-none bg-transparent p-0 hover:bg-white/5'
			/>
			{selected ? (
				<>
					<span className='pointer-events-none absolute left-0 top-0 max-w-full truncate bg-[var(--layer-color)] px-1 text-xs text-black'>{label}</span>
					{(["nw", "ne", "sw", "se"] as const).map((corner) => (
						<Button key={corner} {...pointer} aria-label={`Resize ${label} ${corner.includes("n") ? "top" : "bottom"} ${corner.includes("w") ? "left" : "right"}`} variant='ghost' onPointerDown={(e) => begin(e, corner)} className={`absolute z-10 size-6 min-w-0 touch-none rounded-none p-0 ${corner.includes("n") ? "top-0" : "bottom-0"} ${corner.includes("w") ? "left-0" : "right-0"} ${corner === "nw" || corner === "se" ? "cursor-nwse-resize" : "cursor-nesw-resize"}`}>
							<span className='size-2 border border-white bg-[var(--layer-color)]' />
						</Button>
					))}
				</>
			) : null}
		</div>
	);
}
