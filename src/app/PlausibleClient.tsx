"use client";

import PlausibleProvider from "next-plausible";

// Keep this callback self-contained: next-plausible serializes it into the tracking script.
export function analyticsTrafficProperties() {
	const production = window.location.hostname === "clipify.us";
	const marketingRoute = ["/", "/pricing", "/community", "/changelog", "/roadmap", "/features", "/gallery", "/guides/twitch-clips-in-obs", "/guides/twitch-clip-playlists", "/guides/control-twitch-clip-playback"].includes(window.location.pathname.replace(/\/$/, "") || "/");
	return { traffic_scope: !production ? "nonproduction" : window.self === window.top && marketingRoute ? "marketing" : "runtime" };
}

export default function PlausibleClient({ children }: { children: React.ReactNode }) {
	return (
		<PlausibleProvider enabled={process.env.E2E_TEST_MODE !== "true"} init={{ customProperties: analyticsTrafficProperties }}>
			{children}
		</PlausibleProvider>
	);
}
