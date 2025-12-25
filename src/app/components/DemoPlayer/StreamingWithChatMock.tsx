"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import StreamingSoftwareMock from "./StreamingSoftwareMock";
import FakeTwitchChat from "./FakeTwitchChat";
import "./StreamingWithChatMock.css";

type Props = {
	children: ReactNode;

	title?: string;
	aspectRatio?: string;

	isLive?: boolean;
	liveSeconds?: number;

	style?: CSSProperties;
	statusRightText?: string;

	showChat?: boolean;
	chatWidth?: number;

	iframeRef?: React.RefObject<HTMLIFrameElement>;
};

export default function StreamingWithChatMock({ children, showChat = true, chatWidth = 320, iframeRef, ...obsProps }: Props) {
	const mainRef = useRef<HTMLDivElement | null>(null);
	const [obsHeight, setObsHeight] = useState<number | null>(null);

	useEffect(() => {
		const el = mainRef.current;
		if (!el) return;

		const ro = new ResizeObserver((entries) => {
			const h = Math.round(entries[0]?.contentRect?.height ?? 0);
			setObsHeight(h > 0 ? h : null);
		});

		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	return (
		<div className='streamLayout' style={obsProps.style}>
			<div className='streamLayout__main' ref={mainRef}>
				<StreamingSoftwareMock {...obsProps} style={undefined}>
					{children}
				</StreamingSoftwareMock>
			</div>

			{showChat && (
				<aside
					className='streamLayout__chat'
					style={{
						width: chatWidth,
						height: obsHeight ? `${obsHeight}px` : undefined,
					}}
				>
					<FakeTwitchChat
						isLive={obsProps.isLive ?? true}
						onCommand={(cmd, args) => {
							if (args.length > 0) {
								iframeRef?.current?.contentWindow?.postMessage({ name: cmd, data: args[0] });
							} else {
								iframeRef?.current?.contentWindow?.postMessage({ name: cmd, data: null });
							}
						}}
						onRedeem={(_, input) => {
							iframeRef?.current?.contentWindow?.postMessage({ name: "play", data: input });
						}}
					/>
				</aside>
			)}
		</div>
	);
}
