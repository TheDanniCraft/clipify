"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

type CountdownTimerProps = {
	endAt: string | null;
	className?: string;
	tone?: "light" | "dark";
	showSeconds?: boolean;
	size?: "sm" | "md" | "lg";
	boxClassName?: string;
	separatorClassName?: string;
};

function getCountdownParts(endAt: string | null, now: number, showSeconds: boolean) {
	if (!endAt) return null;
	const endMs = new Date(endAt).getTime();
	if (!Number.isFinite(endMs)) return null;
	const diff = endMs - now;
	if (diff <= 0) return null;
	const totalSeconds = Math.floor(diff / 1000);
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const shouldShowSeconds = showSeconds || totalSeconds < 3600;

	if (days > 0) {
		if (shouldShowSeconds) {
			return [
				String(days).padStart(2, "0"),
				String(hours).padStart(2, "0"),
				String(minutes).padStart(2, "0"),
				String(seconds).padStart(2, "0"),
			];
		}

		return [String(days).padStart(2, "0"), String(hours).padStart(2, "0"), String(minutes).padStart(2, "0")];
	}

	if (shouldShowSeconds) {
		return [
			String(hours).padStart(2, "0"),
			String(minutes).padStart(2, "0"),
			String(seconds).padStart(2, "0"),
		];
	}

	return [String(hours).padStart(2, "0"), String(minutes).padStart(2, "0")];
}

export default function CountdownTimer({ endAt, className = "", tone = "light", showSeconds = false, size = "md", boxClassName = "", separatorClassName = "" }: CountdownTimerProps) {
	const mounted = useSyncExternalStore(
		() => () => undefined,
		() => true,
		() => false,
	);
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (!mounted) return;
		if (!endAt) return;
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, [endAt, mounted]);

	const parts = useMemo(() => (mounted ? getCountdownParts(endAt, now, showSeconds) : null), [endAt, mounted, now, showSeconds]);

	const boxClasses =
		tone === "light"
			? "bg-white text-black shadow-sm"
			: "bg-default-50 text-foreground border border-default-200";
	const separatorToneClasses = tone === "light" ? "text-white" : "text-foreground";
	const sizeClasses =
		size === "sm"
			? { box: "h-7 min-w-7 px-1.5 text-sm", separator: "text-sm" }
			: size === "lg"
				? { box: "h-10 min-w-10 px-2.5 text-lg", separator: "text-lg" }
				: { box: "h-8 min-w-8 px-2 text-base", separator: "text-base" };

	if (!mounted || !parts) {
		return <span className={className}>Ends soon</span>;
	}

	return (
		<div className={`inline-flex items-center gap-1.5 ${className}`}>
			{parts.map((part, partIndex) => (
				<div key={`${part}-${partIndex}`} className='flex items-center gap-1.5'>
					{part.split("").map((digit, digitIndex) => (
						<span
							key={`${digit}-${digitIndex}`}
							className={`inline-flex items-center justify-center rounded-md font-semibold tabular-nums ${boxClasses} ${sizeClasses.box} ${boxClassName}`}
						>
							{digit}
						</span>
					))}
					{partIndex < parts.length - 1 ? <span className={`font-semibold tabular-nums ${separatorToneClasses} ${sizeClasses.separator} ${separatorClassName}`}>:</span> : null}
				</div>
			))}
		</div>
	);
}
