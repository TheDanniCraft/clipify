"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import StreamingWithChatMock from "./StreamingWithChatMock";
import "./DemoPlayer.css";

type DemoMode = "clipify" | "brb";

const INITIAL_VIEWERS = 128;
const VIEWER_STEPS: Record<DemoMode, readonly number[]> = {
	clipify: [0, 1, 0, -1, 1, 0, -1, 0],
	brb: [-3, -5, -2, -4, -6, -3, -5, -4],
};

export function nextDemoViewerCount(current: number, mode: DemoMode, step: number) {
	const changes = VIEWER_STEPS[mode];
	return Math.max(0, current + changes[step % changes.length]);
}

export default function DemoPlayer() {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const viewerStepRef = useRef(0);
	const [mode, setMode] = useState<DemoMode>("clipify");
	const [viewerCount, setViewerCount] = useState(INITIAL_VIEWERS);

	useEffect(() => {
		const id = window.setInterval(() => {
			setViewerCount((current) => nextDemoViewerCount(current, mode, viewerStepRef.current++));
		}, 1800);

		return () => window.clearInterval(id);
	}, [mode]);

	const selectMode = (nextMode: DemoMode) => {
		viewerStepRef.current = 0;
		setViewerCount(INITIAL_VIEWERS);
		setMode(nextMode);
	};

	return (
		<div className='w-full'>
			<StreamingWithChatMock iframeRef={iframeRef as RefObject<HTMLIFrameElement>} chatVariant={mode} viewerCount={viewerCount} onChatVariantChange={selectMode}>
				{mode === "clipify" ? (
					<iframe referrerPolicy='strict-origin-when-cross-origin' ref={iframeRef} className='w-full h-full' src='/demoPlayer' title='Interactive demo player' />
				) : (
					<div className='demoComparison__brb' role='img' aria-label='A static be right back screen'>
						<div className='demoComparison__brbGlow' aria-hidden />
						<p>Stream paused</p>
						<h3>Be right back</h3>
						<span>Hang tight — the stream will continue soon.</span>
					</div>
				)}
			</StreamingWithChatMock>
		</div>
	);
}
