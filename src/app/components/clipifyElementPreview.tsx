"use client";

import { useEffect, useRef } from "react";

export default function ClipifyElementPreview({ type, resourceId, className }: { type: "gallery" | "player"; resourceId: string; className?: string }) {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!ref.current || !resourceId) return;
		let script = document.querySelector<HTMLScriptElement>('script[data-clipify-elements-preview="v1"]');
		if (!script) {
			script = document.createElement("script");
			script.type = "module";
			script.src = "/elements/v1/clipify.js";
			script.dataset.clipifyElementsPreview = "v1";
			document.head.append(script);
		}
		const element = document.createElement(type === "gallery" ? "clipify-gallery" : "clipify-player");
		element.setAttribute(type === "gallery" ? "gallery-id" : "player-id", resourceId);
		ref.current.replaceChildren(element);
		return () => element.remove();
	}, [resourceId, type]);
	return <div ref={ref} className={className} />;
}
