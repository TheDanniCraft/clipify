"use client";

import PlausibleProvider from "next-plausible";

export default function PlausibleClient({ children }: { children: React.ReactNode }) {
	return <PlausibleProvider enabled>{children}</PlausibleProvider>;
}
