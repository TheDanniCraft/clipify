"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Modal } from "@heroui/react";
import { IconRefresh } from "@tabler/icons-react";
import { preserveDeploymentDrafts, hasDeploymentDrafts } from "@lib/deploymentDrafts";
import { usePathname } from "next/navigation";
import { DEPLOYMENT_CHECK_EVENT, DEPLOYMENT_ID_HEADER, isLongLivedRuntimePath, isMissingServerActionError } from "@lib/deployment";

const CHECK_INTERVAL_MS = 5 * 60_000;
const RELOAD_GUARD_MS = 60_000;
const RELOAD_GUARD_KEY = "clipify:deployment-reload";

type ReloadRecord = {
	deploymentId: string;
	reloadedAt: number;
};

function recentlyReloadedFor(deploymentId: string) {
	try {
		const stored = sessionStorage.getItem(RELOAD_GUARD_KEY);
		if (!stored) return false;
		const record = JSON.parse(stored) as Partial<ReloadRecord>;
		return record.deploymentId === deploymentId && typeof record.reloadedAt === "number" && Date.now() - record.reloadedAt < RELOAD_GUARD_MS;
	} catch {
		return false;
	}
}

function rememberReload(deploymentId: string) {
	try {
		sessionStorage.setItem(RELOAD_GUARD_KEY, JSON.stringify({ deploymentId, reloadedAt: Date.now() } satisfies ReloadRecord));
	} catch {
		// Storage may be unavailable in privacy-restricted browser sources.
	}
}

export default function RuntimeDeploymentReload({ deploymentId }: { deploymentId: string }) {
	const pathname = usePathname();
	const checking = useRef(false);
	const sensitiveEdits = useRef(new Set<HTMLInputElement>());
	const notifiedDeployment = useRef<string | null>(null);
	const [promptOpen, setPromptOpen] = useState(false);
	const [updateId, setUpdateId] = useState<string | null>(null);
	const [recoveryError, setRecoveryError] = useState<string | null>(null);

	const checkDeployment = useCallback(
		async (missingAction = false) => {
			if ((!deploymentId && !missingAction) || checking.current) return;
			checking.current = true;
			try {
				const response = await fetch("/api/deployment", { cache: "no-store", credentials: "omit" });
				if (!response.ok) return;
				const currentDeploymentId = response.headers.get(DEPLOYMENT_ID_HEADER)?.trim() || (missingAction ? deploymentId || "missing-action" : "");
				if (!currentDeploymentId || (!missingAction && currentDeploymentId === deploymentId) || recentlyReloadedFor(currentDeploymentId)) return;
				if (isLongLivedRuntimePath(pathname)) {
					rememberReload(currentDeploymentId);
					window.location.reload();
				} else {
					setUpdateId(currentDeploymentId);
					if (notifiedDeployment.current !== currentDeploymentId) {
						notifiedDeployment.current = currentDeploymentId;
						setPromptOpen(true);
					}
				}
			} catch {
				// A temporary network failure should not interrupt an active overlay.
			} finally {
				checking.current = false;
			}
		},
		[deploymentId, pathname],
	);

	useEffect(() => {
		const unattended = Boolean(deploymentId) && isLongLivedRuntimePath(pathname);
		const requestCheck = () => {
			void checkDeployment();
		};
		const editedInputs = sensitiveEdits.current;
		const trackSensitiveEdit = (event: Event) => {
			const input = event.target;
			if (!(input instanceof HTMLInputElement) || !["password", "file"].includes(input.type)) return;
			if (input.value) editedInputs.add(input);
			else editedInputs.delete(input);
		};
		document.addEventListener("input", trackSensitiveEdit, true);
		document.addEventListener("change", trackSensitiveEdit, true);
		const originalFetch = window.fetch;
		const obsoleteActions = new Set<string>();
		const recoveryFetch: typeof fetch = async (input, init) => {
			const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
			const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
			const actionId = url.origin === window.location.origin ? headers.get("Next-Action") : null;
			if (actionId && obsoleteActions.has(actionId)) {
				const error = new Error("Clipify has been updated. Refresh Clipify to continue.");
				error.name = "UnrecognizedActionError";
				throw error;
			}
			const response = await originalFetch(input, init);
			if (actionId && response.headers.get("x-nextjs-action-not-found") === "1") {
				obsoleteActions.add(actionId);
				void checkDeployment(true);
			}
			return response;
		};
		window.fetch = recoveryFetch;

		const checkWhenVisible = () => {
			if (unattended && document.visibilityState === "visible") void checkDeployment();
		};
		const checkWhenSourceActive = (event: Event) => {
			if ((event as CustomEvent<{ active?: unknown }>).detail?.active === true) void checkDeployment();
		};
		const checkAfterActionFailure = (event: ErrorEvent | PromiseRejectionEvent) => {
			const error = "reason" in event ? event.reason : event.error;
			if (isMissingServerActionError(error)) void checkDeployment(true);
		};

		const initialCheck = unattended ? window.setTimeout(requestCheck, 0) : undefined;
		const interval = unattended ? window.setInterval(requestCheck, CHECK_INTERVAL_MS) : undefined;
		window.addEventListener(DEPLOYMENT_CHECK_EVENT, requestCheck);
		window.addEventListener("obsSourceActiveChanged", checkWhenSourceActive);
		window.addEventListener("online", checkWhenVisible);
		window.addEventListener("error", checkAfterActionFailure);
		window.addEventListener("unhandledrejection", checkAfterActionFailure);
		document.addEventListener("visibilitychange", checkWhenVisible);

		return () => {
			document.removeEventListener("input", trackSensitiveEdit, true);
			document.removeEventListener("change", trackSensitiveEdit, true);
			editedInputs.clear();
			if (window.fetch === recoveryFetch) window.fetch = originalFetch;
			window.clearTimeout(initialCheck);
			window.clearInterval(interval);
			window.removeEventListener(DEPLOYMENT_CHECK_EVENT, requestCheck);
			window.removeEventListener("obsSourceActiveChanged", checkWhenSourceActive);
			window.removeEventListener("online", checkWhenVisible);
			window.removeEventListener("error", checkAfterActionFailure);
			window.removeEventListener("unhandledrejection", checkAfterActionFailure);
			document.removeEventListener("visibilitychange", checkWhenVisible);
		};
	}, [checkDeployment, deploymentId, pathname]);

	function refresh() {
		const sensitiveInput = [...sensitiveEdits.current].some((input) => input.isConnected && Boolean(input.value));
		if (sensitiveInput || !preserveDeploymentDrafts()) {
			setRecoveryError(sensitiveInput ? "Copy or finish any unsaved passwords, stream keys or selected files before refreshing. These cannot be restored." : "Your browser could not preserve your changes. Keep this page open and copy your edits before refreshing.");
			return;
		}
		if (updateId) rememberReload(updateId);
		window.location.reload();
	}
	return (
		<>
			{updateId && !promptOpen && (
				<Button variant='secondary' className='fixed bottom-4 left-1/2 z-50 -translate-x-1/2 shadow-lg' onPress={() => setPromptOpen(true)}>
					<IconRefresh size={18} />
					Update available
				</Button>
			)}
			<Modal.Backdrop
				isOpen={Boolean(updateId) && promptOpen}
				onOpenChange={(open) => {
					setPromptOpen(open);
				}}
			>
				<Modal.Container size='sm'>
					<Modal.Dialog>
						<Modal.CloseTrigger />
						<Modal.Header>
							<Modal.Heading>Clipify has been updated</Modal.Heading>
						</Modal.Header>
						<Modal.Body className='space-y-3'>
							<p>{hasDeploymentDrafts() ? "Refresh to continue. Your editor changes will be restored in this tab." : "Refresh to continue. Copy any unsaved edits on this page before refreshing."} Nothing will be saved or started automatically.</p>
							{recoveryError && (
								<p role='alert' className='text-sm text-danger'>
									{recoveryError}
								</p>
							)}
						</Modal.Body>
						<Modal.Footer>
							<Button variant='tertiary' onPress={() => setPromptOpen(false)}>
								Keep editing
							</Button>
							<Button variant='primary' onPress={refresh}>
								<IconRefresh size={18} />
								Refresh Clipify
							</Button>
						</Modal.Footer>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</>
	);
}
