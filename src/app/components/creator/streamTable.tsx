"use client";
import { Table, Link } from "@heroui/react";
import { useRouter } from "next/navigation";
import LocalizedDate from "@components/localizedDate";
import StreamThumbnail from "./streamThumbnail";
import type { getCreatorBroadcasts } from "@actions/creatorLibrary";
type Stream = Extract<Awaited<ReturnType<typeof getCreatorBroadcasts>>, { ok: true }>["items"][number];
export default function StreamTable({ streams }: { streams: Stream[] }) {
	const router = useRouter();
	return (
		<Table>
			<Table.ScrollContainer>
				<Table.Content onRowAction={(key) => router.push(`/dashboard/streams/${encodeURIComponent(String(key))}`)} aria-label='Saved streams' className='w-full lg:min-w-[560px]'>
					<Table.Header>
						<Table.Column isRowHeader>Stream</Table.Column>
						<Table.Column className='hidden lg:table-cell'>Created</Table.Column>
						<Table.Column className='hidden lg:table-cell'>Duration</Table.Column>
						<Table.Column>Known clips</Table.Column>
						<Table.Column className='hidden lg:table-cell'>Clip views</Table.Column>
					</Table.Header>
					<Table.Body>
						{streams.map((stream) => (
							<Table.Row key={stream.id} id={stream.id} data-broadcast-id={stream.id} className='cursor-pointer'>
								<Table.Cell>
									<div className='flex min-w-0 items-center gap-3'>
										<StreamThumbnail src={stream.thumbnailUrl} />
										<Link className='line-clamp-2 min-w-0 font-medium text-foreground' href={`/dashboard/streams/${stream.id}`}>
											{stream.title || "Untitled stream"}
										</Link>
									</div>
									<div className='mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted lg:hidden'>
										<LocalizedDate value={stream.createdAt} showTime />
										<span>{stream.duration}</span>
										<span>{stream.clipViews === null ? "Views unavailable" : `${stream.clipViews.toLocaleString()} views`}</span>
									</div>
								</Table.Cell>
								<Table.Cell className='hidden lg:table-cell'>
									<LocalizedDate value={stream.createdAt} showTime />
								</Table.Cell>
								<Table.Cell className='hidden lg:table-cell'>{stream.duration}</Table.Cell>
								<Table.Cell>{stream.clipCount === null ? "Unavailable" : stream.clipCount.toLocaleString()}</Table.Cell>
								<Table.Cell className='hidden lg:table-cell'>{stream.clipViews === null ? "Unavailable" : stream.clipViews.toLocaleString()}</Table.Cell>
							</Table.Row>
						))}
					</Table.Body>
				</Table.Content>
			</Table.ScrollContainer>
		</Table>
	);
}
