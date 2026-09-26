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
		<div className='demoComparison'>
			<div className='demoComparison__toolbar'>
				<div>
					<p className='demoComparison__eyebrow'>Simulated stream break</p>
					<p className='demoComparison__description'>See how the break experience changes when clips keep playing.</p>
				</div>

				<div className='demoComparison__controls'>
					<div className='demoComparison__toggle' role='group' aria-label='Compare the stream break experience'>
						<button type='button' className={mode === "clipify" ? "isActive" : undefined} aria-pressed={mode === "clipify"} onClick={() => selectMode("clipify")}>
							With Clipify
						</button>
						<button type='button' className={mode === "brb" ? "isActive" : undefined} aria-pressed={mode === "brb"} onClick={() => selectMode("brb")}>
							Without Clipify
						</button>
					</div>

					<div className={`demoComparison__viewers ${mode === "brb" ? "isDropping" : ""}`} aria-live='polite'>
						<span className='demoComparison__liveDot' aria-hidden />
						<strong>{viewerCount}</strong> viewers
					</div>
				</div>
			</div>

			<div className='w-full'>
				<StreamingWithChatMock iframeRef={iframeRef as RefObject<HTMLIFrameElement>} chatVariant={mode}>
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
		</div>
	);
}
