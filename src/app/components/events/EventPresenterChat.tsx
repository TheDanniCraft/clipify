"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { connectEventChatAction, pollEventChatAction } from "@actions/events";
import type { AwardChatCatalog } from "@lib/eventChat";
import type { AwardChatMessage } from "@lib/eventChat";
function textEmotes(text: string, emotes: Record<string, string>) {
	return text.split(/(\s+)/).map((word, index) => (Object.hasOwn(emotes, word) ? <Image key={index} alt={word} title={word} src={emotes[word]} unoptimized width={32} height={32} className='inline-block max-h-8 w-auto align-middle' /> : word));
}
export default function EventPresenterChat({ eventId, secret }: { eventId: string; secret: string }) {
	const [catalog, setCatalog] = useState<AwardChatCatalog | null>(null),
		[messages, setMessages] = useState<AwardChatMessage[]>([]),
		[error, setError] = useState(""),
		[attempt, setAttempt] = useState(0),
		[ready, setReady] = useState(false);
	const end = useRef<HTMLDivElement>(null);
	useEffect(() => {
		let active = true;
		connectEventChatAction(eventId, secret)
			.then((result) => {
				if (!active) return;
				if (result.ok) {
					setError("");
					setCatalog(result.catalog);
					setReady(true);
				} else setError("Chat could not connect. Check the creator’s Twitch connection in the dashboard, then retry.");
			})
			.catch(() => {
				if (active) setError("Chat could not connect. Try again.");
			});
		return () => {
			active = false;
		};
	}, [eventId, secret, attempt]);
	useEffect(() => {
		if (!ready) return;
		let active = true,
			pending = false;
		async function poll() {
			if (pending) return;
			pending = true;
			try {
				const result = await pollEventChatAction(eventId, secret);
				if (!active) return;
				if (result.ok) {
					setMessages(result.messages);
					setError("");
				} else {
					setMessages([]);
					setError("Chat is unavailable. Check the presenter link and retry.");
				}
			} catch {
				if (active) setError("Chat connection interrupted. Retrying…");
			} finally {
				pending = false;
			}
		}
		void poll();
		const timer = setInterval(poll, 1500);
		return () => {
			active = false;
			clearInterval(timer);
		};
	}, [ready, eventId, secret]);
	useEffect(() => {
		end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
	}, [messages]);
	return (
		<aside aria-label='Twitch chat' className='flex h-[65vh] min-w-0 flex-col overflow-hidden rounded-2xl bg-surface p-4'>
			<h2 className='mb-4 text-sm font-semibold text-muted'>Live chat</h2>
			{error ? (
				<div role='status' className='space-y-3 text-sm text-muted'>
					<p>{error}</p>
					<Button
						size='sm'
						variant='secondary'
						onPress={() => {
							setReady(false);
							setError("");
							setAttempt((value) => value + 1);
						}}
					>
						Retry chat
					</Button>
				</div>
			) : null}
			<div className='min-h-0 flex-1 space-y-3 overflow-y-auto break-words' role='log' aria-label='Live reactions'>
				{messages.map((message) => (
					<p key={message.id} className='text-sm leading-7'>
						{message.badges.map((badge) => (catalog?.badges[`${badge.set_id}:${badge.id}`] ? <Image key={`${badge.set_id}:${badge.id}`} alt={badge.set_id} src={catalog.badges[`${badge.set_id}:${badge.id}`]} unoptimized width={18} height={18} className='mr-1 inline-block align-middle' /> : null))}
						<span className='font-semibold' style={message.color ? { color: message.color } : undefined}>
							{message.name}:{" "}
						</span>
						{message.fragments.map((fragment, index) => (fragment.type === "emote" && fragment.emote ? <Image key={index} alt={fragment.text} title={fragment.text} src={`https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(fragment.emote.id)}/default/dark/2.0`} unoptimized width={32} height={32} className='inline-block max-h-8 w-auto align-middle' /> : <span key={index}>{textEmotes(fragment.text, catalog?.emotes ?? {})}</span>))}
					</p>
				))}
				{!messages.length && !error ? <p className='text-sm text-muted'>{ready ? "Waiting for live reactions…" : "Connecting to Twitch…"}</p> : null}
				<div ref={end} />
			</div>
			{catalog?.warnings.map((warning) => (
				<p key={warning} className='mt-2 text-xs text-muted'>
					{warning}
				</p>
			))}
		</aside>
	);
}
