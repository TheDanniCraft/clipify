"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { ConsentManagerProvider, useConsentManager } from "@c15t/nextjs";
import { useHeadlessConsentUI } from "@c15t/nextjs/headless";
import { Button, Card } from "@heroui/react";
import { usePathname } from "next/navigation";
import { isEmbeddedRoute } from "@lib/embeddedRoutes";
import { consentCategoryDetails, consentServices } from "@lib/consent/registry";
import { hadMeasurementConsentAtPageLoad, setBrowserMeasurementConsent } from "@lib/consent/browserMeasurement";
import { applySentryReplayConsent } from "@lib/sentryReplayConsent";
import { AffiliateTracker } from "./AffiliateTracker";
import { clearRevokedConsentStorage } from "@lib/consent/cleanup";
import { clearExpiredStoredConsent } from "@lib/consent/storageExpiry";

// c15t hydrates from localStorage before /init finishes. Drop expired local proof
// before its provider can expose optional categories to integrations.
if (typeof window !== "undefined") clearExpiredStoredConsent();

function ConsentIntegrations() {
	const { has, hasConsented, consentInfo } = useConsentManager();
	const measurement = hasConsented() && has("measurement");
	const pageLoadTraceStarted = useRef(false);

	useEffect(() => {
		setBrowserMeasurementConsent(measurement);
		void applySentryReplayConsent(measurement);
		return () => {
			setBrowserMeasurementConsent(false);
			void applySentryReplayConsent(false);
		};
	}, [measurement]);

	useEffect(() => {
		if (!measurement || !consentInfo?.time || pageLoadTraceStarted.current) return;
		pageLoadTraceStarted.current = true;
		const client = Sentry.getClient();
		const pageLoadTime = performance.timeOrigin;
		if (client && hadMeasurementConsentAtPageLoad(consentInfo.time, pageLoadTime, Date.now())) {
			// Sentry's automatic initial span was sampled out before c15t hydrated.
			// Restart it only for a return visit whose prior consent covered this load.
			Sentry.startBrowserTracingPageLoadSpan(client, {
				name: "Consented page load",
				startTime: pageLoadTime / 1000,
				attributes: { "sentry.op": "pageload", "sentry.source": "custom" },
			});
		}
	}, [measurement, consentInfo?.time]);

	return <AffiliateTracker />;
}

function ConsentInterface() {
	const pathname = usePathname();
	const embedded = isEmbeddedRoute(pathname);
	const { banner, dialog, openDialog, performBannerAction, performDialogAction, saveCustomPreferences } = useHeadlessConsentUI();
	const { consentCategories, consentTypes, consents, selectedConsents, setSelectedConsent } = useConsentManager();
	const [pending, setPending] = useState(false);

	if (embedded) return null;

	const visibleCategories = consentTypes.filter((type) => type.display && consentCategories.includes(type.name));

	async function save(action: () => Promise<unknown>) {
		setPending(true);
		try {
			await action();
		} finally {
			setPending(false);
		}
	}

	if (dialog.isVisible) {
		return (
			<div className='fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center' role='presentation'>
				<Card variant='secondary' className='max-h-[90vh] w-full max-w-xl overflow-y-auto shadow-2xl' role='dialog' aria-modal='true' aria-labelledby='consent-dialog-title'>
					<Card.Content className='space-y-5 p-5 sm:p-6'>
						<div>
							<h2 id='consent-dialog-title' className='text-xl font-semibold'>
								Privacy preferences
							</h2>
							<p className='mt-1 text-sm text-muted'>Choose which optional services Clipify may load. You can change this at any time in the footer.</p>
						</div>
						<div className='divide-y divide-default'>
							{visibleCategories.map((type) => {
								const category = type.name as keyof typeof consentCategoryDetails;
								const details = consentCategoryDetails[category];
								const services = consentServices.filter((service) => service.category === category);
								return (
									<label key={type.name} className='flex items-start justify-between gap-4 py-4'>
										<span>
											<span className='block font-medium'>{details?.title ?? type.name}</span>
											<span className='mt-1 block text-sm text-muted'>{details?.description ?? type.description}</span>
											{services.length > 0 && <span className='mt-2 block text-xs text-muted'>Services: {services.map((service) => service.name).join(", ")}</span>}
										</span>
										<input type='checkbox' className='mt-1 size-5 shrink-0 accent-accent' checked={category === "necessary" || (selectedConsents[type.name] ?? consents[type.name] ?? false)} disabled={type.disabled || category === "necessary" || pending} onChange={(event) => setSelectedConsent(type.name, event.target.checked)} />
									</label>
								);
							})}
						</div>
						<p className='text-xs text-muted'>Cookieless Plausible statistics and minimized operational error reports do not use optional browser storage. See our privacy policy for details.</p>
						<div className='flex flex-wrap gap-2'>
							<Button variant='secondary' isDisabled={pending} onPress={() => void save(() => performDialogAction("reject"))}>
								Reject optional
							</Button>
							<Button variant='secondary' isDisabled={pending} onPress={() => void save(saveCustomPreferences)}>
								Save choices
							</Button>
							<Button variant='secondary' isDisabled={pending} onPress={() => void save(() => performDialogAction("accept"))}>
								Accept all
							</Button>
						</div>
					</Card.Content>
				</Card>
			</div>
		);
	}

	if (!banner.isVisible) return null;

	return (
		<aside className='fixed right-4 bottom-4 left-4 z-[100] sm:left-auto sm:w-[420px]' aria-labelledby='consent-banner-title'>
			<Card variant='secondary' className='border border-default shadow-2xl'>
				<Card.Content className='space-y-4 p-5'>
					<div>
						<h2 id='consent-banner-title' className='text-lg font-semibold'>
							Your privacy choices
						</h2>
						<p className='mt-1 text-sm text-muted'>We use optional services for support, performance measurement and affiliate attribution. Nothing optional loads until you choose.</p>
					</div>
					<div className='flex flex-col gap-2 sm:flex-row sm:flex-wrap'>
						<Button variant='secondary' isDisabled={pending} onPress={() => void save(() => performBannerAction("reject"))}>
							Reject optional
						</Button>
						<Button variant='secondary' isDisabled={pending} onPress={openDialog}>
							Manage preferences
						</Button>
						<Button variant='secondary' isDisabled={pending} onPress={() => void save(() => performBannerAction("accept"))}>
							Accept all
						</Button>
					</div>
					<p className='text-xs text-muted'>
						Read our{" "}
						<a className='underline' href='https://hub.goadopt.io/document/3852d930-97b9-46c2-950d-823e62515ab4?language=en'>
							Privacy Policy
						</a>{" "}
						and{" "}
						<a className='underline' href='https://hub.goadopt.io/document/535d4dc1-7b66-4b96-9bff-bc6e0e47587d?language=en'>
							Cookie Policy
						</a>
						.
					</p>
				</Card.Content>
			</Card>
		</aside>
	);
}

export default function ConsentManager({ children }: { children: ReactNode }) {
	return (
		<ConsentManagerProvider options={{ mode: "hosted", backendURL: "/api/c15t", consentCategories: ["necessary", "functionality", "measurement", "marketing"], store: { reloadOnConsentRevoked: true, callbacks: { onBeforeConsentRevocationReload: ({ preferences }) => clearRevokedConsentStorage(preferences) } } }}>
			<ConsentIntegrations />
			<ConsentInterface />
			{children}
		</ConsentManagerProvider>
	);
}
