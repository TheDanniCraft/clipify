"use client";

import { useCallback, useEffect, useRef } from "react";
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

	const checkDeployment = useCallback(async () => {
		if (!deploymentId || checking.current) return;
		checking.current = true;
		try {
			const response = await fetch("/api/deployment", { cache: "no-store", credentials: "omit" });
			if (!response.ok) return;
			const currentDeploymentId = response.headers.get(DEPLOYMENT_ID_HEADER)?.trim();
			if (!currentDeploymentId || currentDeploymentId === deploymentId || recentlyReloadedFor(currentDeploymentId)) return;
			rememberReload(currentDeploymentId);
			window.location.reload();
		} catch {
			// A temporary network failure should not interrupt an active overlay.
		} finally {
			checking.current = false;
		}
	}, [deploymentId]);

	useEffect(() => {
		if (!isLongLivedRuntimePath(pathname) || !deploymentId) return;

		const checkWhenVisible = () => {
			if (document.visibilityState === "visible") void checkDeployment();
		};
		const checkAfterActionFailure = (event: ErrorEvent | PromiseRejectionEvent) => {
			const error = "reason" in event ? event.reason : event.error;
			if (isMissingServerActionError(error)) void checkDeployment();
		};

		void checkDeployment();
		const interval = window.setInterval(() => void checkDeployment(), CHECK_INTERVAL_MS);
		window.addEventListener(DEPLOYMENT_CHECK_EVENT, checkDeployment);
		window.addEventListener("online", checkWhenVisible);
		window.addEventListener("error", checkAfterActionFailure);
		window.addEventListener("unhandledrejection", checkAfterActionFailure);
		document.addEventListener("visibilitychange", checkWhenVisible);

		return () => {
			window.clearInterval(interval);
			window.removeEventListener(DEPLOYMENT_CHECK_EVENT, checkDeployment);
			window.removeEventListener("online", checkWhenVisible);
			window.removeEventListener("error", checkAfterActionFailure);
			window.removeEventListener("unhandledrejection", checkAfterActionFailure);
			document.removeEventListener("visibilitychange", checkWhenVisible);
		};
	}, [checkDeployment, deploymentId, pathname]);

	return null;
}
