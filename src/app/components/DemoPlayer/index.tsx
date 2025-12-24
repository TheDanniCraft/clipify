"use client";

import { useRef, type RefObject } from "react";
import StreamingWithChatMock from "./StreamingWithChatMock";
export default function DemoPlayer() {
	const iframeRef = useRef<HTMLIFrameElement>(null);

	return (
		<>
			<div className='w-full'>
				<StreamingWithChatMock iframeRef={iframeRef as RefObject<HTMLIFrameElement>}>
					<iframe ref={iframeRef} className='w-full h-full' src='/demoPlayer' />
				</StreamingWithChatMock>
			</div>
		</>
	);
}
