export function resolveRunnerBrandingPlacement(input: { preferredCorner: "top_left" | "top_right" | "bottom_left" | "bottom_right"; viewport: { width: number; height: number }; badge: { width: number; height: number }; occupied: readonly { left: number; top: number; width: number; height: number }[] }) {
	const scale = input.viewport.height / 1080;
	const edge = resolveRunnerAttributionStyle().edgeInset * scale;
	const clearance = 12 * scale;
	const corners = [input.preferredCorner, ...(["top_left", "top_right", "bottom_left", "bottom_right"] as const).filter((corner) => corner !== input.preferredCorner)];
	const candidates = corners.map((position) => ({ status: "placed" as const, left: position.endsWith("right") ? input.viewport.width - input.badge.width - edge : edge, top: position.startsWith("bottom") ? input.viewport.height - input.badge.height - edge : edge, position }));
	const clear = (candidate: { left: number; top: number }) =>
		candidate.left >= edge && candidate.top >= edge && candidate.left + input.badge.width <= input.viewport.width - edge && candidate.top + input.badge.height <= input.viewport.height - edge && input.occupied.every((rect) => candidate.left + input.badge.width + clearance <= rect.left || rect.left + rect.width + clearance <= candidate.left || candidate.top + input.badge.height + clearance <= rect.top || rect.top + rect.height + clearance <= candidate.top);
	const leftEdgeCandidates = input.occupied.flatMap((rect) => [rect.top - input.badge.height - clearance, rect.top + rect.height + clearance]).map((top) => ({ status: "placed" as const, left: edge, top, position: "left_edge" as const }));
	const rightEdgeCandidates = leftEdgeCandidates.map((candidate) => ({ ...candidate, left: input.viewport.width - input.badge.width - edge, position: "right_edge" as const }));
	const topEdgeCandidates = input.occupied.flatMap((rect) => [rect.left - input.badge.width - clearance, rect.left + rect.width + clearance]).map((left) => ({ status: "placed" as const, left, top: edge, position: "top_edge" as const }));
	const bottomEdgeCandidates = topEdgeCandidates.map((candidate) => ({ ...candidate, top: input.viewport.height - input.badge.height - edge, position: "bottom_edge" as const }));
	return candidates.find(clear) ?? leftEdgeCandidates.find(clear) ?? rightEdgeCandidates.find(clear) ?? topEdgeCandidates.find(clear) ?? bottomEdgeCandidates.find(clear) ?? { status: "blocked" as const };
}

export function isRunnerAttributionContrastReadable(ratio: number) {
	return Number.isFinite(ratio) && ratio >= 4.5;
}

export function resolveRunnerAttributionStyle() {
	const foregroundOpacity = 0.85,
		backingOpacity = 0.65;
	// Both fixed composited channels below are above the sRGB linear breakpoint.
	const linear = (channel: number) => ((channel + 0.055) / 1.055) ** 2.4;
	const backingOnWhite = 1 - backingOpacity;
	const inkOnWhite = foregroundOpacity + backingOnWhite * (1 - foregroundOpacity);
	const minimumContrast = (linear(inkOnWhite) + 0.05) / (linear(backingOnWhite) + 0.05);
	return { fontSize: 56, lineHeight: 64, minTextHeight: 128, logoSize: 112, gap: 12, edgeInset: 24, foregroundOpacity, backingOpacity, minimumContrast, readable: isRunnerAttributionContrastReadable(minimumContrast) };
}

/** Conservative painted bounds for canonical computed outset box shadows. */
export function expandRunnerOccupiedRect(box: { left: number; top: number; width: number; height: number }, boxShadow: string, scale = 1) {
	let left = box.left,
		top = box.top,
		right = box.left + box.width,
		bottom = box.top + box.height;
	for (const shadow of boxShadow.split(/,(?![^(]*\))/)) {
		if (shadow.includes("inset")) continue;
		const lengths = (shadow.match(/-?\d*\.?\d+px/g) ?? []).map(Number.parseFloat);
		if (lengths.length !== 4) continue;
		const [x, y, blur, spread] = lengths;
		const extent = (blur * 1.5 + spread) * scale;
		left = Math.min(left, box.left + x * scale - extent);
		right = Math.max(right, box.left + box.width + x * scale + extent);
		top = Math.min(top, box.top + y * scale - extent);
		bottom = Math.max(bottom, box.top + box.height + y * scale + extent);
	}
	return { left, top, width: right - left, height: bottom - top };
}
