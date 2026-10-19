"use client";
import { useEffect, useRef, useState } from "react";
import { connectRunnerStreamingProvider, getRunnerStreamingConnections, getRunnerYoutubeStreams } from "@/app/actions/runner";
type Connection = { id: string; provider: string; channelName: string };
export function useProviderConnection(ownerId: string, onError: (message: string | null) => void) {
	const [connections, setConnections] = useState<Connection[]>([]);
	const [connectionId, setConnectionId] = useState<string | null>(null);
	const [connecting, setConnecting] = useState(false);
	const [streamResult, setStreamResult] = useState<{ connectionId: string; items: { id: string; name: string }[]; error?: string; code?: string } | null>(null);
	const [streamsRequest, setStreamsRequest] = useState(0);
	const [streamId, setStreamId] = useState("");
	const popup = useRef<Window | null>(null);
	const poll = useRef<ReturnType<typeof setInterval> | null>(null);
	useEffect(() => {
		let current = true;
		void getRunnerStreamingConnections(ownerId)
			.then((result) => {
				if (!current) return;
				if (result.success) setConnections(result.connections);
				else onError(result.error);
			})
			.catch(() => {
				if (current) onError("Could not load connected channels. Please try again.");
			});
		return () => {
			current = false;
			if (poll.current) clearInterval(poll.current);
			popup.current?.close();
		};
	}, [ownerId, onError]);
	useEffect(() => {
		let current = true;
		const receive = async (event: MessageEvent) => {
			if (event.origin !== window.location.origin || event.source !== popup.current || event.data?.type !== "runner-provider-connection") return;
			if (poll.current) clearInterval(poll.current);
			popup.current = null;
			setConnecting(false);
			if (!event.data.success) {
				onError("Could not connect the channel. Please try again.");
				return;
			}
			try {
				const result = await getRunnerStreamingConnections(ownerId);
				if (!current) return;
				if (result.success) {
					setConnections(result.connections);
					if (result.connections.some((row) => row.id === event.data.connectionId)) {
						setConnectionId(event.data.connectionId);
						onError(null);
					}
				} else onError(result.error);
			} catch {
				if (current) onError("Could not load the connected channel. Please try again.");
			}
		};
		window.addEventListener("message", receive);
		return () => {
			current = false;
			window.removeEventListener("message", receive);
		};
	}, [ownerId, onError]);
	const connection = connections.find((row) => row.id === connectionId);
	useEffect(() => {
		let current = true;
		if (!connectionId || connection?.provider !== "youtube") return;
		void getRunnerYoutubeStreams({ ownerId, connectionId })
			.then((result) => {
				if (!current) return;
				if (result.success) {
					setStreamResult({ connectionId, items: result.streams });
					setStreamId((previous) => (result.streams.some((stream) => stream.id === previous) ? previous : result.streams.length === 1 ? result.streams[0].id : ""));
				} else {
					setStreamResult({ connectionId, items: [], error: result.error, code: result.code });
				}
			})
			.catch(() => {
				if (current) {
					setStreamResult({ connectionId, items: [], error: "Could not load YouTube stream keys. Please try again." });
				}
			});
		return () => {
			current = false;
		};
	}, [connectionId, connection?.provider, ownerId, onError, streamsRequest]);
	async function connect(provider: "twitch" | "youtube") {
		if (connecting) return;
		onError(null);
		const opened = window.open("about:blank", "clipify-streaming-connection", "popup,width=600,height=760");
		if (!opened) {
			onError("Allow popups for Clipify and try again.");
			return;
		}
		popup.current = opened;
		setConnecting(true);
		try {
			const result = await connectRunnerStreamingProvider({ ownerId, provider });
			if (!result.success) {
				opened.close();
				popup.current = null;
				setConnecting(false);
				onError(result.error);
				return;
			}
			if (opened.closed) {
				popup.current = null;
				setConnecting(false);
				return;
			}
			opened.location.href = result.url;
			poll.current = setInterval(() => {
				if (opened.closed) {
					if (poll.current) clearInterval(poll.current);
					if (popup.current === opened) {
						popup.current = null;
						setConnecting(false);
						onError("Connection cancelled. Your destination has not changed.");
					}
				}
			}, 500);
		} catch {
			opened.close();
			popup.current = null;
			setConnecting(false);
			onError("Could not connect the channel. Please try again.");
		}
	}
	return {
		streamsError: streamResult?.connectionId === connectionId ? streamResult.error : undefined,
		streamsErrorCode: streamResult?.code,
		retryStreams: () => {
			setStreamResult(null);
			setStreamsRequest((value) => value + 1);
		},
		connections,
		connectionId,
		setConnectionId,
		connection,
		connecting,
		connect,
		streams: streamResult?.connectionId === connectionId ? streamResult.items : [],
		streamId,
		setStreamId,
		loadingStreams: connection?.provider === "youtube" && streamResult?.connectionId !== connectionId,
	};
}
