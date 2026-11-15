"use client";

import { useRef, useState } from "react";
import { Button, SearchField, Tabs } from "@heroui/react";
import { compareCommunityStreamers } from "@lib/communitySort";
import type { CommunityPageGroup } from "@lib/community-types";
import CreatorAvatar from "./creator-avatar";

export default function CommunityDirectory({ groups }: { groups: CommunityPageGroup[] }) {
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState("all");
	const [openCreator, setOpenCreator] = useState<{ id: string; pinned: boolean } | null>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const creators = [...new Map(groups.flatMap((group) => group.streamers).map((streamer) => [streamer.id, streamer])).values()].sort(compareCommunityStreamers);
	const categories = [{ key: "all", title: "All creators", description: "", streamers: creators }, ...groups];
	const normalizedQuery = query.trim().toLocaleLowerCase();
	if (!creators.length)
		return (
			<section className='py-12' aria-labelledby='empty-directory-heading'>
				<h2 id='empty-directory-heading' className='text-xl font-semibold'>
					No public creators yet
				</h2>
				<p className='mt-3 text-muted'>Creators can choose to appear here from Settings.</p>
			</section>
		);
	return (
		<section aria-label='Creator directory'>
			<SearchField aria-label='Search creators' value={query} onChange={setQuery} className='mb-6 w-full max-w-md'>
				<SearchField.Group>
					<SearchField.SearchIcon />
					<SearchField.Input ref={searchRef} placeholder='Search by name or username' />
					<SearchField.ClearButton />
				</SearchField.Group>
			</SearchField>
			<Tabs selectedKey={selected} onSelectionChange={(key) => setSelected(String(key))} variant='secondary' className='min-w-0'>
				<Tabs.ListContainer>
					<Tabs.List aria-label='Creator groups'>
						{categories.map((group) => (
							<Tabs.Tab id={group.key} key={group.key} className='w-auto shrink-0 whitespace-nowrap'>
								{group.title}
								<span aria-hidden='true' className='ml-2 text-xs tabular-nums text-muted'>
									{group.streamers.length}
								</span>
								<Tabs.Indicator />
							</Tabs.Tab>
						))}
					</Tabs.List>
				</Tabs.ListContainer>
				{categories.map((group) => {
					const matches = group.streamers.filter((streamer) => `${streamer.displayName} ${streamer.username}`.toLocaleLowerCase().includes(normalizedQuery));
					return (
						<Tabs.Panel id={group.key} key={group.key} className='pt-7'>
							<div className='mb-6 flex flex-wrap items-baseline justify-between gap-3'>
								<div>
									<h2 className='text-xl font-semibold'>{group.title}</h2>
									{group.description ? <p className='mt-2 max-w-2xl text-sm leading-relaxed text-muted'>{group.description}</p> : null}
								</div>
								<p role='status' className='text-sm tabular-nums text-muted'>
									{matches.length} creator{matches.length === 1 ? "" : "s"}
								</p>
							</div>
							{matches.length ? (
								<ul aria-label='Creators' className='grid grid-cols-4 justify-items-center gap-x-4 gap-y-6 py-2 sm:grid-cols-6 lg:grid-cols-10 xl:grid-cols-12'>
									{matches.map((streamer) => (
										<li key={streamer.id} className='min-w-0'>
											<CreatorAvatar streamer={streamer} isOpen={openCreator?.id === streamer.id} pinned={openCreator?.id === streamer.id && openCreator.pinned} onOpenChange={(open, pinned = false) => setOpenCreator((current) => (open ? (!pinned && current?.pinned ? current : { id: streamer.id, pinned }) : current?.id === streamer.id ? null : current))} />
										</li>
									))}
								</ul>
							) : (
								<div className='py-12'>
									<h3 className='text-lg font-semibold'>No creators found</h3>
									<p className='mt-2 text-sm text-muted'>Try another name or reset filters.</p>
									<Button
										variant='secondary'
										className='mt-5'
										onPress={() => {
											setQuery("");
											setSelected("all");
											searchRef.current?.focus();
										}}
									>
										Reset filters
									</Button>
								</div>
							)}
						</Tabs.Panel>
					);
				})}
			</Tabs>
		</section>
	);
}
