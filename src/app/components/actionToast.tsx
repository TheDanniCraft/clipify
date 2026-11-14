"use client";
import { useEffect, useRef } from "react";
import { notify } from "@lib/toast";

// Server-rendered action returns need a client boundary to use the shared toast queue.
export default function ActionToast({ title, description, color }: { title: string; description?: string; color: "success" | "warning" | "danger" }) {
	const reported = useRef("");
	useEffect(() => {
		const key = JSON.stringify([title, description, color]);
		if (reported.current === key) return;
		reported.current = key;
		notify({ title, description, color });
	}, [title, description, color]);
	return null;
}
