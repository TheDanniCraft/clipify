import PublicPageHeader from "@components/LandingPage/publicPageHeader";
import Footer from "@components/footer";
import BasicNavbar from "@components/LandingPage/basicNavbar";
import { GithubRelease } from "@types";
import axios from "axios";
import ReleaseTimeline from "@components/releaseTimeline";

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

			<main className='mx-auto min-h-screen max-w-6xl px-6 py-14 text-foreground sm:px-8 sm:py-20'>
				<PublicPageHeader title='What’s new.' description='The latest improvements to your clips, your scenes, and the tools behind your stream.' />
				{releases.some((release) => !release.prerelease) ? (
					<ReleaseTimeline releases={releases.filter((release) => !release.prerelease)} />
				) : (
					<section className='py-10'>
						<h2 className='text-xl font-semibold'>Updates are temporarily unavailable</h2>
						<p className='mt-3 text-foreground/75'>Please try again in a moment.</p>
					</section>
				)}
			</main>

			<Footer />
		</>
	);
}
