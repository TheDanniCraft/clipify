import BadgeGrid from "@components/membership/BadgeGrid";
import MemberCard from "@components/membership/MemberCard";
import MemberCardActions from "@components/membership/MemberCardActions";
import { getPublicMemberProfile } from "@lib/membership";
import { memberCardPath, memberCardImagePath } from "@lib/memberCardLinks";
import { clipifyShareDescription } from "@lib/memberCardShare";
import { IconArrowLeft, IconRosetteDiscountCheck } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type MemberPageProps = { params: Promise<{ cardId: string }> };

export async function generateMetadata({ params }: MemberPageProps): Promise<Metadata> {
	const { cardId } = await params;
	const profile = await getPublicMemberProfile(cardId);
	if (!profile) return {};

	const publicPath = memberCardPath(profile.cardId);
	const imageUrl = memberCardImagePath(profile.cardId);
	const title = `${profile.username}'s Clipify Member Card`;
	const description = `Meet ${profile.username} from the Clipify community. ${clipifyShareDescription}`;

	return {
		title,
		description,
		robots: { index: false, follow: false },
		alternates: { canonical: publicPath },
		openGraph: { title, description, url: publicPath, type: "profile", images: [{ url: imageUrl, width: 1200, height: 1200, alt: title }] },
		twitter: { card: "summary_large_image", title, description, images: [imageUrl] },
	};
}

export default async function PublicMemberPage({ params }: MemberPageProps) {
	const { cardId } = await params;
	const profile = await getPublicMemberProfile(cardId);
	if (!profile) notFound();

	const imageUrl = memberCardImagePath(profile.cardId);

	return (
		<main className='relative isolate min-h-screen overflow-hidden bg-[#100c1b] text-white'>
			<div aria-hidden='true' className='pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_50%_-10%,rgba(99,85,160,0.3),transparent_36%),radial-gradient(circle_at_12%_68%,rgba(141,66,249,0.16),transparent_28%),radial-gradient(circle_at_88%_76%,rgba(130,106,173,0.16),transparent_30%)]' />
			<div aria-hidden='true' className='pointer-events-none absolute inset-0 -z-10 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]' />

			<nav className='mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8'>
				<Link href='/' className='inline-flex items-center gap-2 text-sm font-semibold text-white/65 transition-colors hover:text-white'>
					<IconArrowLeft aria-hidden='true' size={18} />
					Clipify
				</Link>
				<span className='inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 backdrop-blur-xl'>
					<IconRosetteDiscountCheck aria-hidden='true' size={16} className='text-purple-300' />
					Official Member Card
				</span>
			</nav>

			<section className='mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pb-20 pt-8 sm:px-8 lg:grid-cols-[1fr_420px] lg:gap-20 lg:pt-16'>
				<div className='max-w-2xl text-center lg:text-left'>
					<p className='text-xs font-semibold uppercase tracking-[0.28em] text-purple-300/80'>A place in Clipify history</p>
					<h1 className='mt-5 text-balance text-4xl font-bold tracking-[-0.04em] sm:text-6xl'>
						This card belongs to <span className='bg-gradient-to-r from-purple-300 via-white to-violet-300 bg-clip-text text-transparent'>{profile.username}</span>
					</h1>
					<p className='mx-auto mt-6 max-w-xl text-pretty text-base leading-7 text-white/55 lg:mx-0 lg:text-lg'>A permanent record of their place in the community, made to collect the badges and moments that matter along the way.</p>
					<div className='mt-8 flex justify-center lg:justify-start'>
						<MemberCardActions username={profile.username} cardId={profile.cardId} memberNumber={profile.memberNumber} imageUrl={imageUrl} />
					</div>
				</div>

				<div className='relative mx-auto w-full max-w-[390px] lg:mx-0'>
					<div aria-hidden='true' className='absolute inset-x-6 bottom-0 top-20 rounded-full bg-gradient-to-b from-purple-500/25 to-violet-400/20 blur-[80px]' />
					<MemberCard profile={profile} />
					<p className='mt-8 text-center text-xs text-white/35'>Move your pointer across the card</p>
				</div>
			</section>

			{profile.badges.length > 0 ? (
				<section className='mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8'>
					<div className='rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl backdrop-blur-xl sm:p-8'>
						<p className='text-xs font-semibold uppercase tracking-[0.22em] text-white/40'>Badge collection</p>
						<h2 className='mt-2 text-2xl font-bold tracking-tight'>Recognition that stays with you</h2>
						<div className='mt-6 text-foreground'>
							<BadgeGrid badges={profile.badges} />
						</div>
					</div>
				</section>
			) : null}
		</main>
	);
}
