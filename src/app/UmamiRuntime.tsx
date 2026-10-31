"use client";

import { useEffect, useState } from "react";
import UmamiClient from "./UmamiClient";

export default function UmamiRuntime() {
	const [websiteId, setWebsiteId] = useState("");
	useEffect(() => {
		const controller = new AbortController();
		void fetch("/api/analytics/config", { cache: "no-store", signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) return;
				const config = await response.json();
				if (!controller.signal.aborted && typeof config.websiteId === "string") setWebsiteId(config.websiteId);
			})
			.catch(() => undefined);
		return () => controller.abort();
	}, []);
	return websiteId ? <UmamiClient websiteId={websiteId} /> : null;
}
