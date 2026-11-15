"use client";

import { useRef, useState } from "react";
import { Button, SearchField } from "@heroui/react";
import { compareCommunityStreamers } from "@lib/communitySort";
import type { CommunityPageGroup } from "@lib/community-types";
import CreatorAvatar from "./creator-avatar";

export default function CommunityDirectory({ groups }: { groups: CommunityPageGroup[] }) {
	const [query, setQuery] = useState("");
	const [openCreator, setOpenCreator] = useState<{ id: string; pinned: boolean } | null>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const creators = [...new Map(groups.flatMap((group) => group.streamers).map((streamer) => [streamer.id, streamer])).values()].sort(compareCommunityStreamers);
	const normalizedQuery = query.trim().toLocaleLowerCase();
	const matches = creators.filter((streamer) => `${streamer.displayName} ${streamer.username}`.toLocaleLowerCase().includes(normalizedQuery));
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
			<SearchField
				aria-label='Search creators'
				value={query}
				onChange={(value) => {
					setQuery(value);
					setOpenCreator(null);
				}}
				className='mb-4 w-full max-w-md'
			>
				<SearchField.Group>
					<SearchField.SearchIcon />
					<SearchField.Input ref={searchRef} placeholder='Search by name or username' />
					<SearchField.ClearButton />
				</SearchField.Group>
			</SearchField>
			<p role='status' className='sr-only'>
				{matches.length} creator{matches.length === 1 ? "" : "s"} found
			</p>
			{matches.length ? (
				<ul aria-label='Creators' className='grid grid-cols-[repeat(auto-fill,2.75rem)] gap-2 py-2'>
					{matches.map((streamer) => (
						<li key={streamer.id}>
							<CreatorAvatar streamer={streamer} isOpen={openCreator?.id === streamer.id} pinned={openCreator?.id === streamer.id && openCreator.pinned} onOpenChange={(open, pinned = false) => setOpenCreator((current) => (open ? (!pinned && current?.pinned ? current : { id: streamer.id, pinned }) : current?.id === streamer.id ? null : current))} />
						</li>
					))}
				</ul>
			) : (
				<div className='py-12'>
					<h2 className='text-lg font-semibold'>No creators found</h2>
					<p className='mt-2 text-sm text-muted'>Try another name or clear your search.</p>
					<Button
						variant='secondary'
						className='mt-5'
						onPress={() => {
							setQuery("");
							setOpenCreator(null);
							searchRef.current?.focus();
						}}
					>
						Show all creators
					</Button>
				</div>
			)}
		</section>
	);
}
