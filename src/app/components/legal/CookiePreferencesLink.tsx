"use client";

import { useHeadlessConsentUI } from "@c15t/nextjs/headless";
import { useState } from "react";

export default function CookiePreferencesLink() {
	const consentUi = useHeadlessConsentUI();
	const openDialog = consentUi.openDialog as (() => void) | undefined;
	const [unavailable, setUnavailable] = useState(false);

	function handleOpen() {
		if (!openDialog) {
			setUnavailable(true);
			return;
		}
		setUnavailable(false);
		openDialog();
	}

	return (
		<>
			<button type='button' onClick={handleOpen}>
				Cookie preferences
			</button>
			{unavailable && <p role='status'>Cookie preferences are currently unavailable.</p>}
		</>
	);
}
