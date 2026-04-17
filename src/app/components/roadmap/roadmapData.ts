export enum RoadmapStatus {
	Shipped = "Shipped",
	InDevelopment = "In Development",
	Planned = "Planned",
	Future = "Future",
}

export const roadmapColorOptions = ["emerald", "blue", "purple", "amber", "yellow", "slate", "gray", "zinc", "neutral", "stone", "red", "orange", "lime", "green", "teal", "cyan", "sky", "indigo", "violet", "fuchsia", "pink", "rose"] as const;

export type RoadmapColor = (typeof roadmapColorOptions)[number];

export interface RoadmapItemData {
	icon: string;
	color: RoadmapColor;
	title: string;
	description: string;
	status: RoadmapStatus;
	timeframe: string;
	features: string[];
}

export function normalizeRoadmapStatus(value?: string | null): RoadmapStatus {
	switch ((value ?? "").trim()) {
		case "Shipped":
			return RoadmapStatus.Shipped;
		case "In Development":
			return RoadmapStatus.InDevelopment;
		case "Planned":
			return RoadmapStatus.Planned;
		case "Future":
			return RoadmapStatus.Future;
	default:
			return RoadmapStatus.Planned;
	}
}

export function normalizeRoadmapColor(value?: string | null): RoadmapColor {
	const trimmed = (value ?? "").trim();
	return (roadmapColorOptions as readonly string[]).includes(trimmed) ? (trimmed as RoadmapColor) : "slate";
}
