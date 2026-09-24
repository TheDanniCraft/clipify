"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { ConsentManagerProvider, useConsentManager } from "@c15t/nextjs";
import { useHeadlessConsentUI } from "@c15t/nextjs/headless";
import { Accordion, Button, Card, Modal, Switch } from "@heroui/react";
import { IconArrowLeft, IconChevronDown, IconCookie, IconLock, IconSettings, IconShieldCheck, IconX } from "@tabler/icons-react";
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
	const { consents, selectedConsents, setSelectedConsent, getDisplayedConsents, hasConsented } = useConsentManager();
	const [pendingAction, setPendingAction] = useState<string | null>(null);
	const [returnToBanner, setReturnToBanner] = useState(false);
	const pending = pendingAction !== null;

	if (embedded) return null;

	const visibleCategories = getDisplayedConsents();

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

	function renderBanner(behindModal = false) {
		return (
			<aside className={`fixed inset-x-3 bottom-3 ${behindModal ? "z-[90]" : "z-[100]"}`} aria-labelledby='consent-banner-title' aria-hidden={behindModal || undefined} inert={behindModal || undefined}>
				<Card variant='secondary' className='mx-auto w-full max-w-[1280px] overflow-hidden border border-default bg-surface/95 shadow-xl backdrop-blur-xl'>
					<Card.Content className='grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-5'>
						<div className='flex min-w-0 items-center gap-3'>
							<div className='hidden size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-foreground sm:flex'>
								<IconCookie className='size-5' aria-hidden='true' />
							</div>
							<div className='min-w-0'>
								<h2 id='consent-banner-title' className='text-sm font-semibold sm:text-base'>
									Your privacy choices
								</h2>
								<p className='mt-0.5 text-xs leading-5 text-muted sm:text-sm'>
									Optional support, measurement and affiliate services stay off until you choose. Essential security remains active.{" "}
									<a className='font-medium text-foreground underline underline-offset-2' href='https://hub.goadopt.io/document/3852d930-97b9-46c2-950d-823e62515ab4?language=en'>
										Privacy
									</a>{" "}
									·{" "}
									<a className='font-medium text-foreground underline underline-offset-2' href='https://hub.goadopt.io/document/535d4dc1-7b66-4b96-9bff-bc6e0e47587d?language=en'>
										Cookies
									</a>
								</p>
							</div>
						</div>
						<div className='grid gap-2 sm:grid-cols-3 lg:flex lg:items-center'>
							<Button size='sm' variant='tertiary' isDisabled={pending} onPress={showPreferencesFromBanner}>
								<IconSettings className='size-4' aria-hidden='true' />
								Preferences
							</Button>
							<Button size='sm' variant='outline' isDisabled={pending} isPending={pendingAction === "reject"} onPress={() => void save("reject", () => performBannerAction("reject"))}>
								Reject optional
							</Button>
							<Button size='sm' isDisabled={pending} isPending={pendingAction === "accept"} onPress={() => void save("accept", () => performBannerAction("accept"))}>
								Accept all
							</Button>
						</div>
					</Card.Content>
				</Card>
			</aside>
		);
	}

	if (dialog.isVisible) {
		return (
			<>
				{returnToBanner && !hasConsented() && renderBanner(true)}
				<Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && leavePreferences()} variant='blur' className='z-[100] bg-black/65'>
					<Modal.Container size='md' placement='center' scroll='inside'>
						<Modal.Dialog aria-labelledby='consent-dialog-title' aria-describedby='consent-dialog-description' className='relative overflow-hidden border border-default bg-surface shadow-2xl'>
							<Button isIconOnly aria-label={returnToBanner ? "Back to cookie choices" : "Close privacy preferences"} variant='tertiary' className='absolute top-4 right-4 z-10' onPress={leavePreferences}>
								{returnToBanner ? <IconArrowLeft className='size-5' aria-hidden='true' /> : <IconX className='size-5' aria-hidden='true' />}
							</Button>
							<Modal.Header className='border-b border-default px-5 py-4 pr-14 sm:px-6 sm:pr-14'>
								<Modal.Icon className='bg-accent-soft text-accent-soft-foreground'>
									<IconShieldCheck className='size-5' aria-hidden='true' />
								</Modal.Icon>
								<Modal.Heading id='consent-dialog-title'>Privacy preferences</Modal.Heading>
								<p id='consent-dialog-description' className='mt-1 text-sm leading-5 text-muted'>
									Choose which optional categories Clipify may use.
								</p>
							</Modal.Header>
							<Modal.Body className='px-4 py-4 sm:px-6'>
								<Accordion allowsMultipleExpanded variant='surface' className='w-full overflow-hidden rounded-xl border border-default'>
									{visibleCategories.map((type) => {
										const category = type.name as keyof typeof consentCategoryDetails;
										const details = consentCategoryDetails[category];
										const services = category === "necessary" ? necessaryConsentServices : consentServices.filter((service) => service.category === category);
										const isNecessary = category === "necessary";
										const isSelected = isNecessary || (selectedConsents[type.name] ?? consents[type.name] ?? false);

										return (
											<Accordion.Item key={type.name} id={type.name}>
												<div className='flex min-h-12 items-center gap-3 px-3 sm:px-4'>
													<Accordion.Heading className='min-w-0 flex-1'>
														<Accordion.Trigger className='py-3'>
															{isNecessary && <IconLock className='size-4 shrink-0 text-success' aria-hidden='true' />}
															<span className='min-w-0 flex-1 text-left text-sm font-medium'>{details?.title ?? type.name}</span>
															{isNecessary && <span className='text-xs text-muted'>Always active</span>}
															<Accordion.Indicator>
																<IconChevronDown className='size-4' aria-hidden='true' />
															</Accordion.Indicator>
														</Accordion.Trigger>
													</Accordion.Heading>
													<Switch aria-label={`Allow ${details?.title ?? type.name}`} isSelected={isSelected} isDisabled={type.disabled || isNecessary || pending} onChange={(selected) => setSelectedConsent(type.name, selected)}>
														<Switch.Content>
															<Switch.Control>
																<Switch.Thumb />
															</Switch.Control>
														</Switch.Content>
													</Switch>
												</div>
												<Accordion.Panel>
													<Accordion.Body className='space-y-3 px-4 pt-0 pb-4'>
														<p className='text-xs leading-5 text-muted'>{details?.description ?? type.description}</p>
														<ul className='space-y-2'>
															{services.map((service) => (
																<li key={service.id} className='rounded-lg border border-default bg-surface p-3'>
																	<div className='flex flex-wrap items-center justify-between gap-2'>
																		<span className='text-sm font-medium'>{service.name}</span>
																		<span className='text-xs text-muted'>{service.scope}</span>
																	</div>
																	<p className='mt-1 text-xs leading-5 text-muted'>{service.description}</p>
																	<dl className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs'>
																		<div className='flex gap-1'>
																			<dt className='text-muted'>Provider:</dt>
																			<dd>{service.provider}</dd>
																		</div>
																		<div className='flex gap-1'>
																			<dt className='text-muted'>Storage:</dt>
																			<dd>{service.storage}</dd>
																		</div>
																	</dl>
																</li>
															))}
														</ul>
													</Accordion.Body>
												</Accordion.Panel>
											</Accordion.Item>
										);
									})}
								</Accordion>
							</Modal.Body>
							<Modal.Footer className='flex flex-col-reverse gap-2 border-t border-default px-4 py-3 sm:flex-row sm:justify-end sm:px-6'>
								<Button size='sm' variant='tertiary' isDisabled={pending} onPress={leavePreferences} className='sm:mr-auto'>
									{returnToBanner && <IconArrowLeft className='size-4' aria-hidden='true' />}
									{returnToBanner ? "Back" : "Close"}
								</Button>
								<Button size='sm' variant='outline' isDisabled={pending} isPending={pendingAction === "reject"} onPress={() => void save("reject", () => performDialogAction("reject"))}>
									Reject optional
								</Button>
								<Button size='sm' variant='secondary' isDisabled={pending} isPending={pendingAction === "save"} onPress={() => void save("save", saveCustomPreferences)}>
									Save choices
								</Button>
								<Button size='sm' isDisabled={pending} isPending={pendingAction === "accept"} onPress={() => void save("accept", () => performDialogAction("accept"))}>
									Accept all
								</Button>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</>
		);
	}

	if (!banner.isVisible) return null;

	return renderBanner();
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
