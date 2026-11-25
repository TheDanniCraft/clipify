"use client";

import { lazy, Suspense, type ReactNode, useEffect, useState } from "react";
import { Button, Modal } from "@heroui/react";
import CheckoutFeedback from "@components/checkoutFeedback";
import LocalizedDate from "@components/localizedDate";
import PaymentRecoveryButton from "@components/paymentRecoveryButton";
import type { BillingNotice } from "@lib/billingNotice";
import { trackPaywallEvent } from "@lib/paywallTracking";
import type { AuthenticatedUser } from "@types";

const UpgradeModal = lazy(() => import("@components/upgradeModal"));

export default function DashboardBillingNotice({ notice, user, isVisible = true, children }: { notice?: BillingNotice | null; user?: AuthenticatedUser; isVisible?: boolean; children: ReactNode }) {
	const key = notice && user ? `clipify:billing:${user.id}:${notice.kind}:${notice.kind === "trial" ? notice.endsAt : notice.period}` : null;
	const [decision, setDecision] = useState<{ key: string; show: boolean } | null>(null);
	const [upgradeOpen, setUpgradeOpen] = useState(false);

	useEffect(() => {
		if (!key || !isVisible) return;
		let show = true;
		try {
			show = sessionStorage.getItem(key) === null;
		} catch {
			// The notice can still be dismissed when browser storage is unavailable.
		}
		queueMicrotask(() => setDecision((current) => (current?.key === key ? current : { key, show })));
	}, [key, isVisible]);

	function dismiss() {
		if (!key) return;
		try {
			sessionStorage.setItem(key, "seen");
		} catch {
			// The notice can still be dismissed when browser storage is unavailable.
		}
		setDecision({ key, show: false });
	}

	if (upgradeOpen && user) {
		return (
			<Suspense fallback={null}>
				<UpgradeModal user={user} isOpen onOpenChange={setUpgradeOpen} title='Keep Pro' source='billing_trial' feature='trial_active' returnUrl='/dashboard/settings?tab=billing' />
			</Suspense>
		);
	}
	if (!key || !notice || (decision?.key === key && !decision.show)) {
		return isVisible && user ? (
			<Suspense fallback={children}>
				<CheckoutFeedback>{children}</CheckoutFeedback>
			</Suspense>
		) : (
			children
		);
	}
	if (decision?.key !== key) return null;

	const isOverdue = notice.kind === "overdue";
	let title = "Your Pro payment is overdue";
	if (notice.kind === "trial") {
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(today.getDate() + 1);
		const end = new Date(notice.endsAt).toDateString();
		const when = end === today.toDateString() ? "today" : end === tomorrow.toDateString() ? "tomorrow" : "soon";
		title = `Your Pro trial ends ${when}`;
	}
	return (
		<Modal.Backdrop
			isOpen={isVisible}
			onOpenChange={(open) => {
				if (!open) dismiss();
			}}
		>
			<Modal.Container>
				<Modal.Dialog>
					<Modal.CloseTrigger />
					<Modal.Header>
						<Modal.Heading>{title}</Modal.Heading>
					</Modal.Header>
					<Modal.Body>
						{isOverdue ? (
							<p>Your last Pro payment didn’t go through. Pay your invoice to keep your Pro benefits.</p>
						) : (
							<p>
								Your trial ends <LocalizedDate value={notice.endsAt} showTime />. Choose a Pro subscription to keep your Pro features.
							</p>
						)}
					</Modal.Body>
					<Modal.Footer>
						<Button variant='tertiary' onPress={dismiss}>
							Dismiss
						</Button>
						{isOverdue ? (
							<PaymentRecoveryButton onResolved={dismiss} />
						) : (
							<Button
								variant='primary'
								onPress={() => {
									trackPaywallEvent("paywall_cta_click", { source: "billing_trial", feature: "trial_active", target_plan: "pro" });
									dismiss();
									setUpgradeOpen(true);
								}}
							>
								Keep Pro
							</Button>
						)}
					</Modal.Footer>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
