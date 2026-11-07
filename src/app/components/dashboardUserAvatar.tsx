"use client";
import { useEffect, useState } from "react";
import { Avatar } from "@heroui/react";

export default function DashboardUserAvatar({ username, avatar, showStatus = false }: { username: string; avatar: string; showStatus?: boolean }) {
	const [live, setLive] = useState(false);
	useEffect(() => {
		if (!showStatus) return;
		let mounted = true;
		let pending = false;
		const refresh = async () => {
			if (pending) return;
			pending = true;
			try {
				const response = await fetch("/api/dashboard/presence", { cache: "no-store" });
				const value = response.ok ? (await response.json()).live : null;
				if (mounted) setLive(value === true);
			} catch {
				if (mounted) setLive(false);
			} finally {
				pending = false;
			}
		};
		void refresh();
		const timer = setInterval(() => void refresh(), 30000);
		return () => {
			mounted = false;
			clearInterval(timer);
		};
	}, [showStatus, username]);
	return (
		<span className='relative inline-flex h-8 w-8 shrink-0 overflow-visible'>
			<Avatar size='sm'>
				<Avatar.Image alt={username} src={avatar} />
				<Avatar.Fallback>{username.slice(0, 2).toUpperCase()}</Avatar.Fallback>
			</Avatar>
			{showStatus ? <span aria-label={live ? "Streaming on Twitch" : "Signed in"} title={live ? "Streaming on Twitch" : "Signed in"} className={`absolute bottom-0 right-0 h-2 w-2 rounded-full ring-2 ring-surface ${live ? "bg-danger" : "bg-success"}`} role='status' /> : null}
		</span>
	);
}
