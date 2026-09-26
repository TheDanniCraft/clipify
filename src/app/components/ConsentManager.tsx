"use client";

import type { Key } from "@heroui/react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { ConsentManagerProvider, useConsentManager } from "@c15t/nextjs";
import { useHeadlessConsentUI } from "@c15t/nextjs/headless";
import { Accordion, Button, Card, Modal, Switch } from "@heroui/react";
import { IconActivity, IconBuilding, IconCheck, IconChevronDown, IconCookie, IconDatabase, IconDeviceFloppy, IconLock, IconSettings, IconShieldCheck, IconWorld, IconX } from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import { isEmbeddedRoute } from "@lib/embeddedRoutes";
import { consentCategoryDetails, consentServices, necessaryConsentServices } from "@lib/consent/registry";
import { hadMeasurementConsentAtPageLoad, setBrowserMeasurementConsent } from "@lib/consent/browserMeasurement";
import { applySentryReplayConsent } from "@lib/sentryReplayConsent";
import { clearExpiredStoredConsent } from "@lib/consent/storageExpiry";
import { reloadAfterConsentSave } from "@lib/consent/reload";
import { CONSENT_PREFERENCES_VISIBILITY_EVENT, OPEN_CONSENT_PREFERENCES_EVENT, type ConsentPreferencesVisibilityDetail, type OpenConsentPreferencesDetail } from "@lib/consent/events";
import { legalDocumentRoutes } from "@lib/legal/documents";

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

	return null;
}

function ConsentInterface() {
	const pathname = usePathname();
	const embedded = isEmbeddedRoute(pathname);
	const { banner, dialog, openBanner, openDialog, closeUI, performBannerAction, performDialogAction, saveCustomPreferences } = useHeadlessConsentUI();
	const { consents, selectedConsents, setSelectedConsent, getDisplayedConsents, hasConsented } = useConsentManager();
	const [pendingAction, setPendingAction] = useState<string | null>(null);
	const [returnToBanner, setReturnToBanner] = useState(false);
	const [preferencesRequested, setPreferencesRequested] = useState(false);
	const [expandedCategories, setExpandedCategories] = useState<Set<Key>>(new Set());
	const [saveError, setSaveError] = useState<string | null>(null);
	const pending = pendingAction !== null;
	const preferencesVisible = dialog.isVisible || preferencesRequested;

	useEffect(() => {
		function openRequestedPreferences(event: Event) {
			const detail = (event as CustomEvent<OpenConsentPreferencesDetail>).detail;
			setReturnToBanner(!hasConsented());
			setExpandedCategories(detail?.category ? new Set([detail.category]) : new Set());
			setPreferencesRequested(true);
		}

		window.addEventListener(OPEN_CONSENT_PREFERENCES_EVENT, openRequestedPreferences);
		return () => window.removeEventListener(OPEN_CONSENT_PREFERENCES_EVENT, openRequestedPreferences);
	}, [hasConsented]);

	useEffect(() => {
		window.dispatchEvent(new CustomEvent<ConsentPreferencesVisibilityDetail>(CONSENT_PREFERENCES_VISIBILITY_EVENT, { detail: { visible: preferencesVisible } }));
	}, [preferencesVisible]);

	if (embedded) return null;

	const visibleCategories = getDisplayedConsents();

	function preferencesAfter(actionName: "accept" | "reject" | "save") {
		const preferences = { ...consents };
		for (const type of visibleCategories) {
			if (actionName === "accept") preferences[type.name] = true;
			else if (actionName === "reject") preferences[type.name] = type.name === "necessary";
			else preferences[type.name] = type.name === "necessary" || (selectedConsents[type.name] ?? consents[type.name] ?? false);
		}
		return preferences;
	}

	async function save(actionName: "accept" | "reject" | "save", action: () => Promise<unknown>, surface: "banner" | "dialog") {
		setPendingAction(actionName);
		setSaveError(null);
		try {
			const preferences = preferencesAfter(actionName);
			await action();
			reloadAfterConsentSave(preferences);
		} catch {
			setSaveError("We couldn't save your privacy choices. Please try again.");
			if (surface === "banner") openBanner({ force: true });
			else {
				setPreferencesRequested(true);
				openDialog();
			}
		} finally {
			setPendingAction(null);
		}
	}

	function showPreferencesFromBanner() {
		setReturnToBanner(true);
		setExpandedCategories(new Set());
		setPreferencesRequested(true);
		openDialog();
	}

	function leavePreferences() {
		setPreferencesRequested(false);
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
									Optional support and measurement services stay off until you choose. Essential security remains active.{" "}
									<a className='font-medium text-foreground underline underline-offset-2' href={legalDocumentRoutes.privacy}>
										Privacy
									</a>{" "}
									·{" "}
									<a className='font-medium text-foreground underline underline-offset-2' href={legalDocumentRoutes.cookies}>
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
							<Button size='sm' variant='outline' isDisabled={pending} isPending={pendingAction === "reject"} onPress={() => void save("reject", () => performBannerAction("reject"), "banner")}>
								Reject optional
							</Button>
							<Button size='sm' isDisabled={pending} isPending={pendingAction === "accept"} onPress={() => void save("accept", () => performBannerAction("accept"), "banner")}>
								Accept all
							</Button>
						</div>
						{saveError && (
							<p role='alert' className='text-sm text-danger lg:col-span-2'>
								{saveError}
							</p>
						)}
					</Card.Content>
				</Card>
			</aside>
		);
	}

	if (preferencesVisible) {
		return (
			<>
				{returnToBanner && !hasConsented() && renderBanner(true)}
				<Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && leavePreferences()} variant='blur' className='z-[100] bg-black/65'>
					<Modal.Container size='lg' placement='center' scroll='inside'>
						<Modal.Dialog aria-labelledby='consent-dialog-title' aria-describedby='consent-dialog-description' className='relative overflow-hidden border border-default bg-surface shadow-2xl'>
							<Modal.CloseTrigger aria-label='Close privacy preferences' />
							<Modal.Header className='flex-row items-center gap-3 border-b border-default px-5 py-4 pr-14 sm:px-6 sm:pr-14'>
								<Modal.Icon className='shrink-0 bg-accent-soft text-accent-soft-foreground'>
									<IconShieldCheck className='size-5' aria-hidden='true' />
								</Modal.Icon>
								<Modal.Heading id='consent-dialog-title'>Privacy preferences</Modal.Heading>
							</Modal.Header>
							<Modal.Body className='space-y-4 px-4 py-4 sm:px-6'>
								<p id='consent-dialog-description' className='text-sm leading-5 text-muted'>
									Choose which optional categories Clipify may use.
								</p>
								<Accordion expandedKeys={expandedCategories} onExpandedChange={setExpandedCategories} variant='surface' className='w-full overflow-hidden rounded-xl border border-default'>
									{visibleCategories.map((type) => {
										const category = type.name as keyof typeof consentCategoryDetails;
										const details = consentCategoryDetails[category];
										const services = category === "necessary" ? necessaryConsentServices : consentServices.filter((service) => service.category === category);
										const isNecessary = category === "necessary";
										const isSelected = isNecessary || (selectedConsents[type.name] ?? consents[type.name] ?? false);
										const CategoryIcon = category === "necessary" ? IconLock : category === "functionality" ? IconSettings : IconActivity;

										return (
											<Accordion.Item key={type.name} id={type.name}>
												<div className='group flex min-h-12 items-center gap-3 px-3 transition-colors hover:bg-surface-secondary sm:px-4'>
													<Accordion.Heading className='min-w-0 flex-1'>
														<Accordion.Trigger className='gap-2.5 py-3 hover:bg-transparent'>
															<CategoryIcon className={`size-4 shrink-0 ${isNecessary ? "text-success" : "text-muted"}`} aria-hidden='true' />
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
																<li key={service.id} className='rounded-lg border border-default bg-surface px-3 py-2.5'>
																	<span className='text-sm font-medium'>{service.name}</span>
																	<p className='mt-1 text-xs leading-5 text-muted'>{service.description}</p>
																	<dl className='mt-2 flex flex-wrap gap-1.5 text-xs text-muted'>
																		<div className='flex min-w-0 items-center gap-1 rounded-md bg-surface-secondary px-2 py-1' title={`Provider: ${service.provider}`}>
																			<IconBuilding className='size-3.5 shrink-0' aria-hidden='true' />
																			<dt className='sr-only'>Provider</dt>
																			<dd className='truncate'>{service.provider}</dd>
																		</div>
																		<div className='flex min-w-0 items-center gap-1 rounded-md bg-surface-secondary px-2 py-1' title={`Storage: ${service.storage}`}>
																			<IconDatabase className='size-3.5 shrink-0' aria-hidden='true' />
																			<dt className='sr-only'>Storage</dt>
																			<dd className='truncate'>{service.storage}</dd>
																		</div>
																		<div className='flex min-w-0 items-center gap-1 rounded-md bg-surface-secondary px-2 py-1' title={`Scope: ${service.scope}`}>
																			<IconWorld className='size-3.5 shrink-0' aria-hidden='true' />
																			<dt className='sr-only'>Scope</dt>
																			<dd className='truncate'>{service.scope}</dd>
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
								{saveError && (
									<p role='alert' className='text-sm text-danger'>
										{saveError}
									</p>
								)}
							</Modal.Body>
							<Modal.Footer className='flex flex-col gap-2 border-t border-default px-4 py-4 sm:flex-row sm:justify-center sm:px-6'>
								<Button variant='outline' isDisabled={pending} isPending={pendingAction === "reject"} onPress={() => void save("reject", () => performDialogAction("reject"), "dialog")}>
									<IconX className='size-4' aria-hidden='true' />
									Reject optional
								</Button>
								<Button variant='secondary' isDisabled={pending} isPending={pendingAction === "save"} onPress={() => void save("save", saveCustomPreferences, "dialog")}>
									<IconDeviceFloppy className='size-4' aria-hidden='true' />
									Save choices
								</Button>
								<Button isDisabled={pending} isPending={pendingAction === "accept"} onPress={() => void save("accept", () => performDialogAction("accept"), "dialog")}>
									<IconCheck className='size-4' aria-hidden='true' />
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
		<ConsentManagerProvider options={{ mode: "hosted", backendURL: "/api/c15t", consentCategories: ["necessary", "functionality", "measurement"], store: { reloadOnConsentRevoked: false } }}>
			<ConsentIntegrations />
			<ConsentInterface />
			{children}
		</ConsentManagerProvider>
	);
}
