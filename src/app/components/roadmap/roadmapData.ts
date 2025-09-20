import { TablerIcon, IconFolder, IconFileText, IconGitBranch, IconUsers, IconClipboardData, IconBolt } from "@tabler/icons-react";

export enum RoadmapStatus {
	Shipped = "Shipped",
	InDevelopment = "In Development",
	Planned = "Planned",
	Future = "Future",
}

export interface RoadmapItemData {
	icon: TablerIcon;
	color: string;
	title: string;
	description: string;
	status: RoadmapStatus;
	timeframe: string;
	features: string[];
}

export const roadmapData: RoadmapItemData[] = [
	{
		icon: IconBolt,
		color: "yellow",
		title: "Project Kickoff",
		description: "Launch with core features.",
		status: RoadmapStatus.Shipped,
		timeframe: "Q2 2025",
		features: ["User authentication", "Dashboard & overlay", "Chat widget", "Analytics integration"],
	},
	{
		icon: IconClipboardData,
		color: "blue",
		title: "Payments & Subscriptions",
		description: "Add subscriptions and payments.",
		status: RoadmapStatus.Shipped,
		timeframe: "Q2-Q3 2025",
		features: ["Stripe payments", "Subscription management", "Checkout updates", "Handle subscription cancel"],
	},
	{
		icon: IconFileText,
		color: "green",
		title: "SEO & Accessibility",
		description: "Improve SEO and accessibility.",
		status: RoadmapStatus.Shipped,
		timeframe: "Q3 2025",
		features: ["Sitemap & robots.txt", "Canonical URLs", "Manifest updates", "Accessibility improvements"],
	},
	{
		icon: IconUsers,
		color: "purple",
		title: "Channel Points & Rewards",
		description: "Support channel points and rewards.",
		status: RoadmapStatus.Shipped,
		timeframe: "Q3 2025",
		features: ["Channel point support", "Reward management", "Custom rewards", "Redemption tracking"],
	},
	{
		icon: IconFolder,
		color: "orange",
		title: "Milestones & Improvements",
		description: "Key updates and improvements before v1 release.",
		status: RoadmapStatus.InDevelopment,
		timeframe: "Q3 2025",
		features: ["Add cookie banner", "Improve logging", "Add feedback widget", "Performance improvements"],
	},
	{
		icon: IconGitBranch,
		color: "red",
		title: "v1 Release",
		description: "First major release with stability and polish.",
		status: RoadmapStatus.Planned,
		timeframe: "Planned Q4 2025",
		features: ["Production-ready deployment", "Final bug fixes", "Documentation updates", "User feedback integration"],
	},
];
