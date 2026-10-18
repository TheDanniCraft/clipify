import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export default function PlayerOverlay({ children, top, bottom, left, right, scale, fadeOutSeconds, className, style, reserveBeforeFade = false }: { reserveBeforeFade?: boolean; children: React.ReactNode; top?: string; bottom?: string; left?: string; right?: string; scale?: number; fadeOutSeconds?: number; className?: string; style?: React.CSSProperties }) {
	const [visibility, setVisibility] = useState<"pending" | "visible" | "hidden">("pending");

	useEffect(() => {
		const fadeInTimeout = setTimeout(() => setVisibility("visible"), 1000);
		const shouldFadeOut = (fadeOutSeconds ?? 6) > 0;
		const fadeOutTimeout = shouldFadeOut ? setTimeout(() => setVisibility((current) => (current === "pending" ? current : "hidden")), (fadeOutSeconds ?? 6) * 1000) : null;
		return () => {
			clearTimeout(fadeInTimeout);
			if (fadeOutTimeout) clearTimeout(fadeOutTimeout);
		};
	}, [fadeOutSeconds]);

	const panelClassName = `absolute text-white
						${left ? "rounded-r-md" : ""}
						${right ? "rounded-l-md" : ""}
					${className ?? ""}`;
	const panelStyle: React.CSSProperties = {
		top,
		bottom,
		left,
		right,
		scale: scale ?? 1,
		transformOrigin: `${left ? "left" : right ? "right" : "center"} ${top ? "top" : bottom ? "bottom" : "center"}`,
		...style,
	};

	return (
		<>
			{reserveBeforeFade && visibility === "pending" && (
				<div aria-hidden='true' data-player-overlay='pending-panel' className={panelClassName} style={{ ...panelStyle, opacity: 0, pointerEvents: "none" }}>
					{children}
				</div>
			)}
			<AnimatePresence>
				{visibility === "visible" && (
					<motion.div data-player-overlay='panel' initial={{ opacity: 0.1 }} animate={{ opacity: 1 }} exit={{ opacity: 0.1 }} transition={{ duration: 0.5 }} className={panelClassName} style={panelStyle}>
						{children}
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}
