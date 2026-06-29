import { Avatar, Button, Chip, Link } from "@heroui/react";
import { IconBroadcast, IconBrandTwitch, IconCircleMinus, IconDiamondFilled, IconPlugConnected, IconSparkles } from "@tabler/icons-react";

import { getCommunitySnapshot } from "@lib/community";

import BasicNavbar from "@components/LandingPage/basicNavbar";
import Footer from "@components/footer";

import CommunityHeroAvatars from "./community-hero-avatars";
import { buildCommunityHeroStreamers, buildCommunityPageGroups, type CommunityPageGroup, type CommunityPageStreamer } from "./community-data";

export const metadata = {
	title: "Community | Clipify",
	description: "Meet the creators using Clipify and see how the community turns the tool into something bigger.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getStatusTone(status: CommunityPageStreamer["status"]) {
	switch (status) {
		case "live_with_overlay":
			return { color: "success" as const };
		case "live":
			return { color: "danger" as const };
		default:
			return { color: "default" as const };
	}
}

function getSectionTone(group: CommunityPageGroup) {
	switch (group.key) {
		case "partners":
			return { color: "secondary" as const, icon: <IconSparkles size={16} />, variant: "flat" as const };
		case "pro":
			return { color: "primary" as const, icon: <IconDiamondFilled size={16} />, variant: "solid" as const };
		case "now_live_with_clipify":
			return { color: "success" as const, icon: <IconPlugConnected size={16} />, variant: "flat" as const };
		case "now_live":
			return { color: "danger" as const, icon: <IconBroadcast size={16} />, variant: "flat" as const };
		default:
			return { color: "default" as const, icon: <IconCircleMinus size={16} />, variant: "flat" as const };
	}
}

function StreamerRow({ streamer }: { streamer: CommunityPageStreamer }) {
	const statusTone = getStatusTone(streamer.status);
	const canOpenTwitch = streamer.partner || streamer.plan === "pro";
	const badgeLabel = streamer.partner ? "Partner" : streamer.plan === "pro" ? "Pro" : "Free";
	const badgeColor = badgeLabel === "Partner" ? "secondary" : badgeLabel === "Pro" ? "primary" : "default";
	const badgeVariant = badgeLabel === "Pro" ? "solid" : "flat";

	return (
		<div className='flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between'>
			<div className='flex min-w-0 items-center gap-3'>
				<Avatar alt={streamer.displayName} color={statusTone.color} isBordered radius='full' size='md' src={streamer.avatar} />
				<div className='min-w-0'>
					<div className='flex flex-wrap items-center gap-2'>
						<p className='truncate text-base font-semibold text-foreground'>{streamer.displayName}</p>
						<Chip size='sm' color={badgeColor} variant={badgeVariant}>
							{badgeLabel}
						</Chip>
					</div>
					<p className='truncate text-sm text-default-500'>@{streamer.username}</p>
				</div>
			</div>

			{canOpenTwitch ? (
				<Button as={Link} href={streamer.twitchUrl} rel='noreferrer' target='_blank' color='primary' radius='full' size='sm' variant='light' endContent={<IconBrandTwitch size={16} />}>
					Open Twitch
				</Button>
			) : null}
		</div>
	);
}

function CommunitySection({ group }: { group: CommunityPageGroup }) {
	const tone = getSectionTone(group);
	const streamers = group.streamers;

	return (
		<section className='border-t border-default-200 pt-12'>
			<div className='flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
				<div className='min-w-0'>
					<Chip color={tone.color} startContent={tone.icon} variant={tone.variant}>
						{group.title}
					</Chip>
					<p className='mt-3 max-w-3xl text-sm text-default-500'>{group.description}</p>
				</div>
				<Chip color='default' className='self-start' variant='flat'>
					{streamers.length} streamer{streamers.length === 1 ? "" : "s"}
				</Chip>
			</div>
			<div className='mt-6 divide-y divide-default-200'>
				{streamers.map((streamer) => (
					<StreamerRow key={`${group.key}:${streamer.id}`} streamer={streamer} />
				))}
			</div>
		</section>
	);
}

export default async function CommunityPage() {
	const snapshot = await getCommunitySnapshot();
	const featuredStreamers = buildCommunityHeroStreamers(snapshot);
	const communityGroups = buildCommunityPageGroups(snapshot);

	return (
		<div className='bg-background text-foreground'>
			<div className='bg-gradient-to-br from-primary-800 to-primary-400 min-h-dvh relative flex flex-col overflow-hidden text-white'>
				<BasicNavbar />
				<div
					className='
						pointer-events-none
						absolute inset-[-20%]
						bg-hero-vignette
						mix-blend-multiply
						blur-3xl
						opacity-30
					'
				/>
				<div className='mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-12 sm:px-6 lg:px-8'>
					<main className='container mx-auto flex flex-1 flex-col justify-center overflow-hidden px-0'>
						<section className='z-20 grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]'>
							<div className='flex flex-col items-start gap-6'>
								<h1 className='max-w-3xl text-[clamp(40px,10vw,64px)] font-bold leading-[1.05] tracking-tighter'>
									Clipify itself is just some code.
									<br />
									With you, it becomes a powerful tool.
								</h1>
								<p className='max-w-xl text-lg leading-8 text-white/70'>See how creators are using Clipify in real streams and how the community puts the tool to work.</p>
								<div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
									<Button as={Link} href='/login' radius='full' className='h-10 w-[163px] bg-white px-[16px] py-[10px] text-small font-medium leading-5 text-black'>
										Register now
									</Button>
								</div>
								<div className='pt-2'>
									<CommunityHeroAvatars streamers={featuredStreamers} />
								</div>
							</div>

							<div />
						</section>
					</main>
				</div>
			</div>
			<div className='w-full bg-background px-4 py-24'>
				<div className='mx-auto flex w-full max-w-6xl flex-col'>
					<div className='mt-8'>
						{communityGroups.map((group) => (
							<CommunitySection key={group.key} group={group} />
						))}
					</div>
				</div>
			</div>
			<Footer />
		</div>
	);
}
