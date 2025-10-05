import { Card, CardBody, Chip, Link } from "@heroui/react";
import Footer from "@components/footer";
import BasicNavbar from "@components/LandingPage/basicNavbar";
import { GithubRelease } from "@types";
import axios from "axios";
import xss from "xss";

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
			<script src='//tag.goadopt.io/injector.js?website_code=792b9b29-57f9-4d92-b5f1-313f94ddfacc' className='adopt-injector' defer></script>
			<BasicNavbar />

			<div className='min-h-screen bg-background text-foreground p-6'>
				<div className='max-w-5xl mx-auto'>
					<h1 className='text-4xl font-bold text-center mb-2 flex items-center justify-center gap-2'>
						<span className='text-primary'>📝</span>
						Changelog
						<span className='text-primary'>📝</span>
					</h1>
					<p className='text-center text-default-400 mb-12'>Latest updates and improvements to Clipify</p>

					<div className='relative'>
						<div className='absolute left-3.5 top-6 bottom-6 w-0.5 bg-gradient-to-b from-default-400 via-default-400 to-transparent opacity-20 z-0'></div>
						<div className='space-y-6'>
							{!releases || releases.length === 0 ? (
								<div className='text-gray-600 text-center py-4'>Error while fetching releases.</div>
							) : (
								releases
									.filter((release: GithubRelease) => release.prerelease === false)
									.map((release: GithubRelease) => (
										<div key={release.id} className='flex items-start gap-6 relative'>
											<div className='relative z-10 flex items-center justify-center'>
												<Chip color='primary' size='sm' className='my-2'>
													{release.name || release.tag_name}
												</Chip>
											</div>
											<div className='flex-1 space-y-1'>
												<Card className='flex-1 p-4'>
													<CardBody>
														<Link className='pb-2' href={release.html_url} isExternal showAnchorIcon>
															<h3 className='text-lg font-semibold'>Release {release.name || release.tag_name}</h3>
														</Link>
														<p
															className='text-sm'
															dangerouslySetInnerHTML={{
																__html: xss(release.body).replace(/(?:\r\n|\r|\n)/g, "<br />"),
															}}
														/>
													</CardBody>
												</Card>
												<span className='text-xs mr-4 text-gray-400 ml-auto flex justify-end'>{release.published_at}</span>
											</div>
										</div>
									))
							)}
						</div>
					</div>
				</div>
			</div>

			<Footer />
		</>
	);
}
