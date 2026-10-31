import * as TablerIcons from "@tabler/icons-react";
import { IconBolt, type Icon } from "@tabler/icons-react";
import type { RoadmapColor } from "./roadmapData";

function getIconColorClasses(color: RoadmapColor): string {
	switch (color) {
		case "emerald":
			return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-500";
		case "blue":
			return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-500";
		case "purple":
			return "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-500";
		case "amber":
			return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-500";
		case "yellow":
			return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-500";
		case "slate":
			return "bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-500";
		case "gray":
			return "bg-gray-100 text-gray-700 dark:bg-gray-950 dark:text-gray-500";
		case "zinc":
			return "bg-zinc-100 text-zinc-700 dark:bg-zinc-950 dark:text-zinc-500";
		case "neutral":
			return "bg-neutral-100 text-neutral-700 dark:bg-neutral-950 dark:text-neutral-500";
		case "stone":
			return "bg-stone-100 text-stone-700 dark:bg-stone-950 dark:text-stone-500";
		case "red":
			return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-500";
		case "orange":
			return "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-500";
		case "lime":
			return "bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-500";
		case "green":
			return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-500";
		case "teal":
			return "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-500";
		case "cyan":
			return "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-500";
		case "sky":
			return "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-500";
		case "indigo":
			return "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-500";
		case "violet":
			return "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-500";
		case "fuchsia":
			return "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-500";
		case "pink":
			return "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-500";
		case "rose":
			return "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-500";
		default:
			return "bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-500";
	}
}

export default function RoadmapIcon({ icon, color }: { icon: string; color: RoadmapColor }) {
	const registry = TablerIcons as unknown as Record<string, Icon>;
	const ResolvedIcon = registry[icon] ?? IconBolt;
	return (
		<span aria-hidden className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${getIconColorClasses(color)}`}>
			<ResolvedIcon size={24} />
		</span>
	);
}
