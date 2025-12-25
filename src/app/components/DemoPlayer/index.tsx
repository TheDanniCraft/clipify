"use client";

import { useRef, type RefObject } from "react";
import StreamingWithChatMock from "./StreamingWithChatMock";
export default function DemoPlayer() {
	const iframeRef = useRef<HTMLIFrameElement>(null);

	return (
		<>
			<div className='w-full'>
				<StreamingWithChatMock iframeRef={iframeRef as RefObject<HTMLIFrameElement>}>
					<iframe referrerPolicy='strict-origin-when-cross-origin' ref={iframeRef} className='w-full h-full' src='/demoPlayer' title='Interactive demo player' />
				</StreamingWithChatMock>
			</div>
		</>
	);
}
