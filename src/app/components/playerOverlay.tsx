import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function PlayerOverlay({ children, top, bottom, left, right }: { children: React.ReactNode; top?: string; bottom?: string; left?: string; right?: string }) {
	const [show, setShow] = useState(false);

	useEffect(() => {
		const fadeInTimeout = setTimeout(() => setShow(true), 1000);
		const fadeOutTimeout = setTimeout(() => setShow(false), 6000);
		return () => {
			clearTimeout(fadeInTimeout);
			clearTimeout(fadeOutTimeout);
		};
	}, []);

	return (
		<AnimatePresence>
			{show && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.5 }}
					className={`absolute text-white bg-zinc-900 p-2
						${left ? "rounded-r-md" : ""}
						${right ? "rounded-l-md" : ""}
						w-fit break-words
					`}
					style={{
						top,
						bottom,
						left: left ? 0 : undefined,
						right: right ? 0 : undefined,
						scale: 2,
						transformOrigin: `${left ? "left" : right ? "right" : "center"} ${top ? "top" : bottom ? "bottom" : "center"}`,
					}}
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>
	);
}
