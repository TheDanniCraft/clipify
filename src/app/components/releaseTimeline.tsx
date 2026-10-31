"use client";

import { Timeline } from "@heroui-pro/react";
import { Chip } from "@heroui/react";
import type { GithubRelease } from "@types";
import LocalizedDate from "@components/localizedDate";
import ReleaseNotes from "@components/releaseNotes";

export default function ReleaseTimeline({ releases }: { releases: GithubRelease[] }) {
	return (
		<Timeline aria-label='Clipify releases' size='sm' density='compact' className='w-full'>
			{releases.map((release, index) => (
				<Timeline.Item key={release.id} status={index === 0 ? "current" : "default"}>
					<Timeline.Content className='min-w-0 gap-0 border-b border-separator pb-10 sm:pb-14'>
						<article className='min-w-0'>
							<div className='mb-4 flex flex-wrap items-center gap-3 text-sm text-foreground/70'>
								<LocalizedDate value={release.published_at} />
								{index === 0 && (
									<Chip className='text-foreground' size='sm' variant='soft' color='accent'>
										Latest release
									</Chip>
								)}
							</div>
							<h2 className='mb-5 text-2xl font-semibold tracking-tight sm:text-3xl'>{release.name || release.tag_name}</h2>
							<ReleaseNotes body={release.body ?? ""} />
						</article>
					</Timeline.Content>
				</Timeline.Item>
			))}
		</Timeline>
	);
}
