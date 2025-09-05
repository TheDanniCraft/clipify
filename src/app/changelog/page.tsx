import { Button, Card, CardBody, CardHeader, Chip, Divider, Image, Link, ScrollShadow } from "@heroui/react";
import { IconArrowLeft } from "@tabler/icons-react";
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

	return (
		<>
			<script src='//tag.goadopt.io/injector.js?website_code=792b9b29-57f9-4d92-b5f1-313f94ddfacc' className='adopt-injector' defer></script>

			<div className='min-h-screen flex items-center justify-center p-0 sm:p-10 lg:p-15 bg-gradient-to-br from-primary-800 to-primary-400'>
				<Card fullWidth className='h-screen flex-grow p-0 sm:h-fit sm:p-2 rounded-none sm:rounded-2xl'>
					<CardHeader className='flex flex-col items-start gap-2'>
						<Button isIconOnly variant='light' as={Link} href='/' aria-label='Back to Home'>
							<IconArrowLeft />
						</Button>
						<div className='flex'>
							<Image height={40} src='https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Spiral%20Calendar.png' alt='Changelog Icon' />
							<h1 className='pl-2 text-3xl font-bold'>Changelog</h1>
						</div>
					</CardHeader>
					<Divider />
					<CardBody>
						<ScrollShadow className='h-[400px]'>
							<ul>
								{(async () => {
									const releases = await getReleases();
									if (!releases || releases.length === 0) {
										return <li className='text-gray-600 text-center py-4'>Error while fetching releases.</li>;
									}
									return releases
										.filter((release: GithubRelease) => release.prerelease === false)
										.map((release: GithubRelease) => (
											<li key={release.id} className='mb-6'>
												<Link href={release.html_url}>
													<Chip variant='shadow' color='primary' size='sm' className='my-2'>
														{release.name || release.tag_name}
													</Chip>
												</Link>
												<p
													className='text-sm'
													dangerouslySetInnerHTML={{
														__html: xss(release.body).replace(/(?:\r\n|\r|\n)/g, "<br />"),
													}}
												/>
												<span className='text-xs text-gray-400'>{release.published_at}</span>
											</li>
										));
								})()}
							</ul>
						</ScrollShadow>
					</CardBody>
				</Card>
			</div>
		</>
	);
}
