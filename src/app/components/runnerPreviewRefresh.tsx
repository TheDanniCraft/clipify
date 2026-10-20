"use client";

import { useEffect, useState } from "react";

export default function RunnerPreviewRefresh({ refreshedAt }: { refreshedAt: number }) {
	const [seconds, setSeconds] = useState(2);
	useEffect(() => {
		const update = () => setSeconds(Math.max(0, Math.ceil((refreshedAt + 2000 - Date.now()) / 1000)));
		update();
		const interval = setInterval(update, 1000);
		return () => clearInterval(interval);
	}, [refreshedAt]);
	return (
		<span role='timer' aria-label='Snapshot refresh' aria-live='off' className='text-xs tabular-nums text-muted'>
			{seconds > 0 ? `Refresh in ${seconds}s` : "Refreshing…"}
		</span>
	);
}
