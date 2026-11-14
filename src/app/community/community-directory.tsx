"use client";

import { useRef, useState } from "react";
import { Avatar, Button, Card, Chip, Link, SearchField, Tabs } from "@heroui/react";
import { IconBrandTwitch } from "@tabler/icons-react";
import { getCommunityAvatarTone } from "@lib/communityAvatarTone";
import { compareCommunityStreamers } from "@lib/communitySort";
import type { CommunityPageGroup, CommunityPageStreamer } from "@lib/community-types";

function CreatorCard({ streamer }: { streamer: CommunityPageStreamer }) {
	const tone = getCommunityAvatarTone(streamer);
	const membership = streamer.partner ? "Partner" : streamer.plan === "pro" ? "Pro" : "Free";
	const status = streamer.status === "live_with_overlay" ? "Live with Clipify" : streamer.status === "live" ? "Live on Twitch" : "Offline";
	return (
		<Card role='article' aria-label={`${streamer.displayName} creator`} className='h-full border border-border shadow-none'>
			<Card.Header className='flex-row items-start gap-4'>
				<Avatar role='img' aria-label={`${streamer.displayName}: ${tone.label}`} color={tone.color} variant='soft' className={`size-16 shrink-0 ring-2 ${tone.ringClass}`}>
					<Avatar.Image alt='' src={streamer.avatar} />
					<Avatar.Fallback>{streamer.displayName.slice(0, 2).toUpperCase()}</Avatar.Fallback>
				</Avatar>
				<div className='min-w-0'>
					<h3 className='break-words text-lg font-semibold leading-snug'>
						{streamer.profileUrl ? (
							<Link href={streamer.profileUrl} className='text-foreground'>
								{streamer.displayName}
							</Link>
						) : (
							streamer.displayName
						)}
					</h3>
					<p className='mt-1 break-all text-sm text-muted'>@{streamer.username}</p>
					<div className='mt-3 flex flex-wrap items-center gap-2'>
						<Chip size='sm' variant='soft' color={streamer.status === "live_with_overlay" ? "success" : streamer.status === "live" ? "danger" : "default"}>
							{status}
						</Chip>
						<Chip size='sm' variant='tertiary' color={streamer.partner || streamer.plan === "pro" ? "accent" : "default"}>
							{membership}
						</Chip>
					</div>
				</div>
			</Card.Header>
			{streamer.partner || streamer.plan === "pro" ? (
				<Card.Footer className='mt-auto'>
					<Link href={streamer.twitchUrl} target='_blank' rel='noreferrer' className='gap-2 text-sm text-foreground'>
						<IconBrandTwitch className='size-4' aria-hidden='true' />
						Open Twitch
					</Link>
				</Card.Footer>
			) : null}
		</Card>
	);
}

export default function CommunityDirectory({ groups }: { groups: CommunityPageGroup[] }) {
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState("all");
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
								<ul aria-label='Creators' className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
									{matches.map((streamer) => (
										<li key={streamer.id} className='min-w-0'>
											<CreatorCard streamer={streamer} />
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
