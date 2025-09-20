import React from "react";
import { Card, Chip } from "@heroui/react";
import { RoadmapStatus, RoadmapItemData } from "./roadmapData";
import { IconChevronRight } from "@tabler/icons-react";

interface RoadmapItemProps extends Omit<RoadmapItemData, "status"> {
	status: RoadmapStatus;
}

function getIconColorClasses(color: string): string {
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

export const RoadmapItem: React.FC<RoadmapItemProps> = ({ icon, color, title, description, status, timeframe, features }) => {
	return (
		<div className='flex items-start gap-6 relative'>
			<div className='relative z-10 mt-6 flex items-center justify-center'>
				<div className={`w-7 h-7 rounded-full border-4 border-background ${getStatusColor(status)}`}></div>
			</div>

			<Card className='flex-1 p-6 bg-content1 border-none'>
				<div className='space-y-4'>
					<div className='flex items-start'>
						<div className={`p-3 rounded-md ${getIconColorClasses(color)} mr-4`}>{React.createElement(icon, { className: "w-6 h-6" })}</div>
						<div className='flex-1'>
							<h3 className='text-xl font-semibold mb-1'>{title}</h3>
							<p className='text-default-400'>{description}</p>
						</div>
					</div>

					<div className='flex items-center gap-3'>
						<Chip variant='flat' size='sm' className={`bg-${getChipColor(status)}-100 text-${getChipColor(status)}-700 dark:bg-${getChipColor(status)}-900 dark:text-${getChipColor(status)}-300`}>
							{status}
						</Chip>
						<span className='text-default-400'>{timeframe}</span>
					</div>

					<div className='grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 pt-2'>
						{features.map((feature, index) => (
							<div key={index} className='flex items-center gap-2 text-default-400 py-1'>
								<IconChevronRight className='text-default-500 w-4 h-4 flex-shrink-0' />
								<span>{feature}</span>
							</div>
						))}
					</div>
				</div>
			</Card>
		</div>
	);
};

function getStatusColor(status: RoadmapStatus): string {
	switch (status) {
		case RoadmapStatus.Shipped:
			return "bg-green-500";
		case RoadmapStatus.InDevelopment:
			return "bg-blue-500";
		case RoadmapStatus.Planned:
			return "bg-purple-500";
		case RoadmapStatus.Future:
			return "bg-gray-500";
		default:
			return "bg-gray-500";
	}
}

function getChipColor(status: RoadmapStatus): string {
	switch (status) {
		case RoadmapStatus.Shipped:
			return "green";
		case RoadmapStatus.InDevelopment:
			return "blue";
		case RoadmapStatus.Planned:
			return "purple";
		case RoadmapStatus.Future:
			return "gray";
		default:
			return "gray";
	}
}
