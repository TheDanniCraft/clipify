"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { ConsentManagerProvider, useConsentManager } from "@c15t/nextjs";
import { useHeadlessConsentUI } from "@c15t/nextjs/headless";
import { Button, Card, Modal, Switch } from "@heroui/react";
import { IconArrowLeft, IconCookie, IconLock, IconSettings, IconShieldCheck, IconX } from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import { isEmbeddedRoute } from "@lib/embeddedRoutes";
import { consentCategoryDetails, consentServices, necessaryConsentServices } from "@lib/consent/registry";
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
	const { banner, dialog, openBanner, openDialog, closeUI, performBannerAction, performDialogAction, saveCustomPreferences } = useHeadlessConsentUI();
	const { consentCategories, consentTypes, consents, selectedConsents, setSelectedConsent } = useConsentManager();
	const [pendingAction, setPendingAction] = useState<string | null>(null);
	const [returnToBanner, setReturnToBanner] = useState(false);
	const pending = pendingAction !== null;

	if (embedded) return null;

	const visibleCategories = consentTypes.filter((type) => type.display && consentCategories.includes(type.name));

	async function save(actionName: string, action: () => Promise<unknown>) {
		setPendingAction(actionName);
		try {
			await action();
			setReturnToBanner(false);
		} finally {
			setPendingAction(null);
		}
	}

	function showPreferencesFromBanner() {
		setReturnToBanner(true);
		openDialog();
	}

	function leavePreferences() {
		if (returnToBanner) {
			setReturnToBanner(false);
			openBanner({ force: true });
			return;
		}

		closeUI();
	}

	if (dialog.isVisible) {
		return (
			<Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && leavePreferences()} variant='blur' className='z-[100] bg-black/70'>
				<Modal.Container size='lg' placement='center' scroll='inside'>
					<Modal.Dialog aria-labelledby='consent-dialog-title' aria-describedby='consent-dialog-description' className='relative overflow-hidden border border-default bg-surface shadow-2xl'>
						<Button isIconOnly aria-label={returnToBanner ? "Back to cookie choices" : "Close privacy preferences"} variant='tertiary' className='absolute top-4 right-4 z-10' onPress={leavePreferences}>
							{returnToBanner ? <IconArrowLeft className='size-5' aria-hidden='true' /> : <IconX className='size-5' aria-hidden='true' />}
						</Button>
						<Modal.Header className='border-b border-default px-5 py-5 sm:px-7'>
							<Modal.Icon className='bg-accent-soft text-accent-soft-foreground'>
								<IconShieldCheck className='size-5' aria-hidden='true' />
							</Modal.Icon>
							<Modal.Heading id='consent-dialog-title'>Privacy preferences</Modal.Heading>
							<p id='consent-dialog-description' className='mt-1.5 max-w-2xl text-sm leading-6 text-muted'>
								Choose which optional services Clipify may use. Essential security and consent storage always remain active. You can change these choices at any time in the footer.
							</p>
						</Modal.Header>
						<Modal.Body className='space-y-3 px-5 py-5 sm:px-7'>
							{visibleCategories.map((type) => {
								const category = type.name as keyof typeof consentCategoryDetails;
								const details = consentCategoryDetails[category];
								const services = category === "necessary" ? necessaryConsentServices : consentServices.filter((service) => service.category === category);
								const isNecessary = category === "necessary";
								const isSelected = isNecessary || (selectedConsents[type.name] ?? consents[type.name] ?? false);

								return (
									<section key={type.name} className='rounded-2xl border border-default bg-surface-secondary p-4 sm:p-5'>
										<div className='flex items-start justify-between gap-4'>
											<div className='min-w-0'>
												<div className='flex flex-wrap items-center gap-2'>
													{isNecessary && <IconLock className='size-4 shrink-0 text-success' aria-hidden='true' />}
													<h3 className='font-semibold'>{details?.title ?? type.name}</h3>
													{isNecessary && <span className='rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success-soft-foreground'>Always active</span>}
												</div>
												<p className='mt-1 text-sm leading-5 text-muted'>{details?.description ?? type.description}</p>
											</div>
											<Switch aria-label={`Allow ${details?.title ?? type.name}`} isSelected={isSelected} isDisabled={type.disabled || isNecessary || pending} onChange={(selected) => setSelectedConsent(type.name, selected)}>
												<Switch.Content>
													<Switch.Control>
														<Switch.Thumb />
													</Switch.Control>
												</Switch.Content>
											</Switch>
										</div>
										{services.length > 0 && (
											<ul className='mt-4 grid gap-2 border-t border-default pt-3 sm:grid-cols-2'>
												{services.map((service) => (
													<li key={service.id} className='text-xs leading-5 text-muted'>
														<span className='font-medium text-foreground'>{service.name}</span> — {service.description}
													</li>
												))}
											</ul>
										)}
									</section>
								);
							})}
						</Modal.Body>
						<Modal.Footer className='flex flex-col-reverse gap-2 border-t border-default px-5 py-4 sm:flex-row sm:justify-end sm:px-7'>
							<Button variant='tertiary' isDisabled={pending} onPress={leavePreferences} className='sm:mr-auto'>
								{returnToBanner && <IconArrowLeft className='size-4' aria-hidden='true' />}
								{returnToBanner ? "Back" : "Close"}
							</Button>
							<Button variant='outline' isDisabled={pending} isPending={pendingAction === "reject"} onPress={() => void save("reject", () => performDialogAction("reject"))}>
								Reject optional
							</Button>
							<Button variant='secondary' isDisabled={pending} isPending={pendingAction === "save"} onPress={() => void save("save", saveCustomPreferences)}>
								Save choices
							</Button>
							<Button isDisabled={pending} isPending={pendingAction === "accept"} onPress={() => void save("accept", () => performDialogAction("accept"))}>
								Accept all
							</Button>
						</Modal.Footer>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		);
	}

	if (!banner.isVisible) return null;

	return (
		<aside className='fixed inset-x-3 bottom-3 z-[100] sm:inset-x-5 sm:bottom-5 lg:inset-x-8' aria-labelledby='consent-banner-title'>
			<Card variant='secondary' className='mx-auto w-full max-w-[1500px] overflow-hidden border border-default bg-surface/95 shadow-2xl backdrop-blur-xl'>
				<Card.Content className='grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-8 lg:px-7'>
					<div className='flex min-w-0 items-start gap-3 sm:gap-4'>
						<div className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground sm:size-11'>
							<IconCookie className='size-5 sm:size-6' aria-hidden='true' />
						</div>
						<div className='min-w-0'>
							<h2 id='consent-banner-title' className='text-base font-semibold sm:text-lg'>
								Your privacy, your choice
							</h2>
							<p className='mt-1 max-w-3xl text-sm leading-5 text-muted'>We use optional services for support, real-world performance measurement and affiliate attribution. Essential security services always remain active.</p>
							<p className='mt-2 text-xs text-muted'>
								Read our{" "}
								<a className='font-medium text-foreground underline underline-offset-2' href='https://hub.goadopt.io/document/3852d930-97b9-46c2-950d-823e62515ab4?language=en'>
									Privacy Policy
								</a>{" "}
								and{" "}
								<a className='font-medium text-foreground underline underline-offset-2' href='https://hub.goadopt.io/document/535d4dc1-7b66-4b96-9bff-bc6e0e47587d?language=en'>
									Cookie Policy
								</a>
								.
							</p>
						</div>
					</div>
					<div className='grid gap-2 sm:grid-cols-3 lg:flex lg:items-center'>
						<Button variant='tertiary' isDisabled={pending} onPress={showPreferencesFromBanner}>
							<IconSettings className='size-4' aria-hidden='true' />
							Preferences
						</Button>
						<Button variant='outline' isDisabled={pending} isPending={pendingAction === "reject"} onPress={() => void save("reject", () => performBannerAction("reject"))}>
							Reject optional
						</Button>
						<Button isDisabled={pending} isPending={pendingAction === "accept"} onPress={() => void save("accept", () => performBannerAction("accept"))}>
							Accept all
						</Button>
					</div>
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
