"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import type { AwardChatCatalog } from "@lib/eventChat";
import type { AwardChatMessage } from "@lib/eventChat";
function textEmotes(text: string, emotes: Record<string, string>) {
	return text.split(/(\s+)/).map((word, index) => (Object.hasOwn(emotes, word) ? <Image key={index} alt={word} title={word} src={emotes[word]} unoptimized width={32} height={32} className='inline-block max-h-8 w-auto align-middle' /> : word));
}
export default function EventPresenterChat({ eventId, secret, preview = false }: { eventId: string; secret: string; preview?: boolean }) {
	const [catalog, setCatalog] = useState<AwardChatCatalog | null>(null),
		[messages, setMessages] = useState<AwardChatMessage[]>([]),
		[error, setError] = useState(""),
		[attempt, setAttempt] = useState(0),
		[ready, setReady] = useState(false);
	const log = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!secret) return;
		let active = true,
			socket: WebSocket,
			retry: ReturnType<typeof setTimeout> | undefined,
			retries = 0;
		function connect() {
			if (!active) return;
			setReady(false);
			const url = new URL("/ws", window.location.href);
			url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
			const connection = new WebSocket(url);
			socket = connection;
			connection.onopen = () => connection.send(JSON.stringify({ type: "event_chat_subscribe", data: { eventId, secret, preview } }));
			connection.onmessage = (event) => {
				if (!active || socket !== connection) return;
				try {
					const frame = JSON.parse(event.data);
					if (frame.type === "event_chat_catalog") {
						setCatalog(frame.data);
						setReady(true);
						setError("");
						retries = 0;
					} else if (frame.type === "event_chat_messages" && Array.isArray(frame.data?.messages)) {
						setMessages(frame.data.messages);
						setError("");
					} else if (frame.type === "event_chat_error") {
						setError("Chat could not connect. Check that chat is enabled and the link is current, then retry.");
					}
				} catch {
					setError("Chat received an invalid update. Reconnect to retry.");
				}
			};
			connection.onerror = () => {
				if (active) setError("Chat connection interrupted. Retrying…");
			};
			connection.onclose = (event) => {
				if (!active || socket !== connection) return;
				setReady(false);
				if (event.code === 4002 || event.code === 4003) {
					setError("Chat access ended. Check the link and chat setting, then retry.");
					return;
				}
				setError("Chat connection interrupted. Retrying…");
				retry = setTimeout(connect, Math.min(10000, 1000 * 2 ** retries++));
			};
		}
		connect();
		return () => {
			active = false;
			clearTimeout(retry);
			socket?.close();
		};
	}, [eventId, secret, preview, attempt]);
	useEffect(() => {
		if (log.current) log.current.scrollTop = log.current.scrollHeight;
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
			<div ref={log} className='min-h-0 flex-1 space-y-3 overflow-y-auto break-words' role='log' aria-label='Live reactions'>
				{messages.map((message) => (
					<p key={message.id} className='text-sm leading-7'>
						{message.badges.map((badge) => (catalog?.badges[`${badge.set_id}:${badge.id}`] ? <Image key={`${badge.set_id}:${badge.id}`} alt={badge.set_id} src={catalog.badges[`${badge.set_id}:${badge.id}`]} unoptimized width={18} height={18} className='mr-1 inline-block align-middle' /> : null))}
						{message.sevenTvBadge ? <Image alt={`7TV ${message.sevenTvBadge.name}`} title={`7TV ${message.sevenTvBadge.name}`} src={message.sevenTvBadge.url} unoptimized width={18} height={18} className='mr-1 inline-block align-middle' /> : null}
						<span className='font-semibold' style={message.color ? { color: message.color } : undefined}>
							{message.name}:{" "}
						</span>
						{message.fragments.map((fragment, index) => (fragment.type === "emote" && fragment.emote ? <Image key={index} alt={fragment.text} title={fragment.text} src={`https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(fragment.emote.id)}/default/dark/2.0`} unoptimized width={32} height={32} className='inline-block max-h-8 w-auto align-middle' /> : <span key={index}>{textEmotes(fragment.text, catalog?.emotes ?? {})}</span>))}
					</p>
				))}
				{!messages.length && !error ? <p className='text-sm text-muted'>{ready ? "Waiting for live reactions…" : "Connecting to Twitch…"}</p> : null}
			</div>
			{catalog?.warnings.map((warning) => (
				<p key={warning} className='mt-2 text-xs text-muted'>
					{warning}
				</p>
			))}
		</aside>
	);
}
