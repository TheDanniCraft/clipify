import { socialPreview } from "@lib/socialPreview";
import { IconArrowRight } from "@tabler/icons-react";
import { getPublicCommunityPageDataAction } from "@actions/community";
import BasicNavbar from "@components/LandingPage/basicNavbar";
import MarketingLink from "@components/LandingPage/MarketingLink";
import Footer from "@components/footer";
import CommunityHeroAvatars from "./community-hero-avatars";
import CommunityDirectory from "./community-directory";

export const metadata = {
	title: "Community | Clipify",
	description: "Meet and celebrate the creators who make Clipify part of their streams.",
	alternates: { canonical: "https://clipify.us/community" },
	openGraph: { ...socialPreview, title: "Community | Clipify", url: "https://clipify.us/community" },
};
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CommunityPage() {
	const { featuredStreamers, communityGroups, totalCount } = await getPublicCommunityPageDataAction();
	return (
		<div className='bg-background text-foreground'>
			<BasicNavbar classNames={{ wrapper: "max-w-7xl" }} />
			<main className='mx-auto w-full max-w-7xl px-6 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16'>
				<header className='mb-8 border-b border-border pb-8 sm:mb-10 sm:pb-10'>
					<div className='max-w-3xl'>
						<p className='mb-3 text-sm font-medium text-muted'>The Clipify community</p>
						<h1 className='text-4xl font-semibold leading-tight tracking-tight sm:text-5xl'>You make Clipify more than code.</h1>
						<p className='mt-4 max-w-xl text-lg leading-relaxed text-muted'>Thank you to the creators who make Clipify part of their streams. Meet the people already putting it to work.</p>
						<div className='mt-5 flex flex-wrap items-center gap-x-3 gap-y-2'>
							<p className='text-sm text-muted'>Make it part of your stream, too.</p>
							<MarketingLink href='/login' placement='community' className='inline-flex items-center gap-1.5 font-semibold no-underline'>
								Start free
								<IconArrowRight size={18} aria-hidden='true' />
							</MarketingLink>
						</div>
					</div>
					<div className='mt-6 flex flex-wrap items-center gap-4'>
						{featuredStreamers.length ? <CommunityHeroAvatars streamers={featuredStreamers} totalCount={totalCount} /> : null}
						<p className='text-sm text-muted'>
							{totalCount} public creator{totalCount === 1 ? "" : "s"}
						</p>
					</div>
				</header>
				<CommunityDirectory groups={communityGroups} />
				<p className='mt-10 border-t border-border pt-6 text-sm leading-relaxed text-muted'>Meet creators with public Clipify profiles. You can manage your profile and community visibility in Settings.</p>
			</main>
			<Footer />
		</div>
	);
}
