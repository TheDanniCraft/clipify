"use client";

import PlausibleProvider from "next-plausible";

export default function PlausibleClient({ children }: { children: React.ReactNode }) {
	return <PlausibleProvider enabled={process.env.E2E_TEST_MODE !== "true"}>{children}</PlausibleProvider>;
}
