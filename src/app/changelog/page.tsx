import { Card, CardContent, Chip, Link, LinkIcon } from "@components/heroui-client";

import Footer from "@components/footer";
import LocalizedDate from "@components/localizedDate";
import BasicNavbar from "@components/LandingPage/basicNavbar";
import { GithubRelease } from "@types";
import axios from "axios";
import ReleaseNotes from "@components/releaseNotes";

export const metadata = {
	title: "Changelog | Clipify",
	description: "See the latest Clipify releases and improvements to Twitch clip playback, overlays, and creator tools.",
	alternates: { canonical: "https://clipify.us/changelog" },
	openGraph: { title: "Changelog | Clipify", description: "See the latest Clipify releases and improvements to Twitch clip playback, overlays, and creator tools.", url: "https://clipify.us/changelog" },
};

export default async function ChangelogPage() {
	async function getReleases(): Promise<GithubRelease[]> {
		try {
			const response = await axios.get("https://api.github.com/repos/thedannicraft/clipify/releases");
			return response.data || [];
		} catch {
			return [];
		}
	}

	const releases = await getReleases();

	return (
		<>
			<BasicNavbar />

			<main className='min-h-screen bg-background px-6 py-12 text-foreground'>
				<div className='max-w-5xl mx-auto'>
					<h1 className='text-4xl font-bold text-center mb-2 flex items-center justify-center gap-2'>
						<span className='text-accent'>📝</span>
						Changelog
						<span className='text-accent'>📝</span>
					</h1>
					<p className='text-center text-muted mb-12'>Latest updates and improvements to Clipify</p>

					<div className='relative'>
						<div className='absolute left-3.5 top-6 bottom-6 w-0.5 bg-gradient-to-b from-muted via-muted to-transparent opacity-20 z-0'></div>
						<div className='space-y-6'>
							{!releases || releases.length === 0 ? (
								<div className='text-gray-600 text-center py-4'>Can&apos;t load changelog right now.</div>
							) : (
								releases
									.filter((release: GithubRelease) => release.prerelease === false)
									.map((release: GithubRelease) => (
										<div key={release.id} className='flex items-start gap-6 relative'>
											<div className='relative z-10 flex items-center justify-center'>
												<Chip color='accent' size='sm' className='my-2'>
													{release.name || release.tag_name}
												</Chip>
											</div>
											<div className='flex-1 space-y-1'>
												<Card className='flex-1 p-4'>
													<CardContent>
														<Link className='pb-2' href={release.html_url} target='_blank' rel='noopener noreferrer'>
															<h3 className='text-lg font-semibold'>Release {release.name || release.tag_name}</h3>
															<LinkIcon />
														</Link>
														<p className='mb-5 text-sm text-foreground/75'>
															<LocalizedDate value={release.published_at} />
														</p>
														<ReleaseNotes body={release.body ?? ""} />
													</CardContent>
												</Card>
											</div>
										</div>
									))
							)}
						</div>
					</div>
				</div>
			</main>

			<Footer />
		</>
	);
}
