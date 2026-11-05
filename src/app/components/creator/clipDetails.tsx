"use client";
import { useEffect, useTransition } from "react";
import { buttonVariants } from "@heroui/styles";
import { useRouter } from "next/navigation";
import { Button, Card, Link } from "@heroui/react";
import { IconArrowLeft, IconBrandTwitch, IconDeviceMobile } from "@tabler/icons-react";
import type { getCreatorClipDetail } from "@actions/creatorLibrary";
import DashboardEditorLayout from "@components/dashboardEditorLayout";
import LocalizedDate from "@components/localizedDate";
import CodeSnippet from "@components/codeSnippet";
import { notify } from "@lib/toast";
import ClipPlayer from "./clipPlayer";
import ClipExport from "./clipExport";

type DetailResult = Awaited<ReturnType<typeof getCreatorClipDetail>>;
export default function ClipDetails({ creatorId, data }: { creatorId: string; data: DetailResult }) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	useEffect(() => {
		if (!data.ok) notify({ title: data.code === "NOT_FOUND" ? "Clip unavailable" : "Clip details could not be loaded", description: "Return to your inventory or try again.", color: "danger" });
	}, [data]);
	const clip = data.ok ? data.clip : null;
	return (
		<DashboardEditorLayout>
			<Card className='w-full'>
				<Card.Header className='flex flex-row flex-wrap items-start justify-between gap-4'>
					<div className='flex min-w-0 items-start gap-3'>
						<Button isIconOnly variant='tertiary' aria-label='Back to clip inventory' onPress={() => router.push("/dashboard/clips")}>
							<IconArrowLeft />
						</Button>
						<h2 className='min-w-0 break-words text-xl font-semibold'>{clip?.title || (data.ok ? "Untitled clip" : "Clip unavailable")}</h2>
					</div>
					{clip ? (
						<Link href={clip.url} target='_blank' rel='noopener noreferrer' className='gap-2 rounded-lg bg-accent-soft px-3 py-2 font-medium text-accent-soft-foreground'>
							<IconBrandTwitch className='size-4' aria-hidden='true' />
							Open on Twitch
						</Link>
					) : null}
				</Card.Header>
				<Card.Content className='space-y-6'>
					{clip && data.ok ? (
						<>
							<ClipPlayer creatorId={creatorId} clipId={clip.id} />
							<div className='flex flex-wrap items-center gap-3'>
								<Link className={buttonVariants({ variant: "secondary", className: "gap-2" })} href={`/dashboard/clips/layout?clips=${encodeURIComponent(clip.id)}`}>
									<IconDeviceMobile className='size-4' aria-hidden='true' />
									Create portrait clip
								</Link>
								<ClipExport clipNames={{ [clip.id]: clip.title }} creatorId={creatorId} clipIds={[clip.id]} scope={`${creatorId}:${clip.id}`} format='mp4' />
							</div>
							<dl className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
								{[
									["Channel", clip.broadcasterName ?? "Unavailable"],
									["Clipped by", clip.clipCreatorName ?? "Unavailable"],
									["Category", data.categoryName ?? "Unavailable"],
									["Views", String(clip.views)],
									["Duration", `${Math.round(clip.duration)} seconds`],
									["Language", clip.language?.toUpperCase() ?? "Unavailable"],
									["Featured", clip.isFeatured ? "Yes" : "No"],
								].map(([label, value]) => (
									<div key={label} className='min-w-0'>
										<dt className='text-sm text-muted'>{label}</dt>
										<dd className='break-words font-medium tabular-nums'>{value}</dd>
									</div>
								))}
								<div>
									<dt className='text-sm text-muted'>Created</dt>
									<dd>
										<LocalizedDate value={clip.createdAt} showTime />
									</dd>
								</div>
								<div>
									<dt className='text-sm text-muted'>Metadata updated</dt>
									<dd>
										<LocalizedDate value={data.fetchedAt} showTime />
									</dd>
								</div>
								{clip.videoId ? (
									<div>
										<dt className='text-sm text-muted'>Source stream</dt>
										<dd>
											<Link href={`/dashboard/streams/${encodeURIComponent(clip.videoId)}`}>View stream</Link>
											{clip.vodOffsetSeconds !== null ? <span className='ml-2 text-sm text-muted'>{Math.round(clip.vodOffsetSeconds)}s into stream</span> : null}
										</dd>
									</div>
								) : null}
							</dl>
							<div className='min-w-0'>
								<p className='mb-2 text-sm text-muted'>Clip ID</p>
								<CodeSnippet symbol='' className='w-full' preClassName='overflow-x-auto whitespace-pre'>
									{clip.id}
								</CodeSnippet>
							</div>
						</>
					) : (
						<div className='flex min-h-48 flex-col items-start justify-center gap-4'>
							<p className='text-muted'>This clip is unavailable in the current account.</p>
							<Button variant='secondary' isPending={pending} onPress={() => startTransition(() => router.refresh())}>
								Retry loading clip
							</Button>
						</div>
					)}
				</Card.Content>
			</Card>
		</DashboardEditorLayout>
	);
}
