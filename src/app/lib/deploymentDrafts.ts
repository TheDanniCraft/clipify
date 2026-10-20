"use client";
import { useEffect, useRef } from "react";

const STORAGE_KEY = "clipify:deployment-drafts";
const MAX_AGE_MS = 30 * 60_000;
const sensitiveField = /secret|password|token|credential|streamkey/i;
type DraftRecord = { changes: Record<string, unknown>; baseline: Record<string, unknown> };
type SavedDrafts = { expiresAt: number; pathname: string; drafts: Record<string, DraftRecord> };
const editors = new Map<string, () => DraftRecord>();

function readDrafts(): SavedDrafts | null {
	try {
		const record = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as SavedDrafts | null;
		if (!record || record.pathname !== location.pathname || typeof record.expiresAt !== "number" || record.expiresAt <= Date.now() || !record.drafts || typeof record.drafts !== "object") return null;
		return record;
	} catch {
		return null;
	}
}

export function hasDeploymentDrafts() {
	return editors.size > 0;
}

export function preserveDeploymentDrafts() {
	try {
		const drafts = Object.fromEntries([...editors].map(([key, capture]) => [key, capture()]));
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ pathname: location.pathname, expiresAt: Date.now() + MAX_AGE_MS, drafts } satisfies SavedDrafts));
		return true;
	} catch {
		return false;
	}
}

/** Store only edited fields, never unchanged server secrets or whole resource records. */
export function useDeploymentDraft<T extends object>(key: string | null, draft: T, saved: T, restore: (draft: T, saved: T) => void) {
	const current = useRef({ draft, saved, restore });
	useEffect(() => {
		current.current = { draft, saved, restore };
	}, [draft, saved, restore]);
	useEffect(() => {
		if (!key) return;
		const pending = readDrafts();
		const entry = pending?.drafts[key];
		if (pending && entry) {
			delete pending.drafts[key];
			try {
				sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
				const allowed = (values: Record<string, unknown>) => values && typeof values === "object" && Object.keys(values).every((field) => Object.hasOwn(current.current.draft, field) && !sensitiveField.test(field));
				if (allowed(entry.changes) && allowed(entry.baseline) && Object.keys(entry.changes).length) current.current.restore({ ...current.current.draft, ...entry.changes }, { ...current.current.saved, ...entry.baseline });
			} catch {
				// Keep the loaded editor intact if tab storage is unavailable or malformed.
			}
		}
		editors.set(key, () => {
			const { draft, saved } = current.current;
			const changes: Record<string, unknown> = {};
			const baseline: Record<string, unknown> = {};
			for (const field of Object.keys(draft) as (keyof T & string)[]) {
				if (JSON.stringify(draft[field]) === JSON.stringify(saved[field])) continue;
				if (sensitiveField.test(field)) throw new Error("Sensitive draft cannot be stored");
				changes[field] = draft[field];
				baseline[field] = saved[field];
			}
			if (Object.keys(changes).length && "configurationRevision" in saved) {
				changes.configurationRevision = saved.configurationRevision;
				baseline.configurationRevision = saved.configurationRevision;
			}
			return { changes, baseline };
		});
		return () => {
			editors.delete(key);
		};
	}, [key]);
}
