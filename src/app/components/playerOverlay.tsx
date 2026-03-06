import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function PlayerOverlay({
	children,
	top,
	bottom,
	left,
	right,
	scale,
	fadeOutSeconds,
	className,
	style,
}: {
	children: React.ReactNode;
	top?: string;
	bottom?: string;
	left?: string;
	right?: string;
	scale?: number;
	fadeOutSeconds?: number;
	className?: string;
	style?: React.CSSProperties;
}) {
	const [show, setShow] = useState(false);

	useEffect(() => {
		const fadeInTimeout = setTimeout(() => setShow(true), 1000);
		const shouldFadeOut = (fadeOutSeconds ?? 6) > 0;
		const fadeOutTimeout = shouldFadeOut ? setTimeout(() => setShow(false), (fadeOutSeconds ?? 6) * 1000) : null;
		return () => {
			clearTimeout(fadeInTimeout);
			if (fadeOutTimeout) clearTimeout(fadeOutTimeout);
		};
	}, [fadeOutSeconds]);

	return (
		<AnimatePresence>
			{show && (
				<motion.div
					initial={{ opacity: 0.1 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0.1 }}
					transition={{ duration: 0.5 }}
					className={`absolute text-white
						${left ? "rounded-r-md" : ""}
						${right ? "rounded-l-md" : ""}
					${className ?? ""}`}
					style={{
						top,
						bottom,
						left,
						right,
						scale: scale ?? 1,
						transformOrigin: `${left ? "left" : right ? "right" : "center"} ${top ? "top" : bottom ? "bottom" : "center"}`,
						...style,
					}}
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>
	);
}
