import { timingSafeEqual } from "node:crypto";

export type OverlayRuntimeChannel = "http" | "websocket";

export type OverlayRuntimeRecord = {
	id: string;
	ownerId: string;
	secret: string | null;
};

export type OverlayRuntimeDenial = "not-found" | "invalid-secret" | "owner-suspended" | "plan-restricted";

export type OverlayRuntimeDecision<TOverlay extends OverlayRuntimeRecord> = { allowed: true; overlay: TOverlay } | { allowed: false; reason: "owner-suspended"; overlay: TOverlay; ownerDisabledReason: string | null } | { allowed: false; reason: Exclude<OverlayRuntimeDenial, "owner-suspended"> };

function secretsMatch(expected: string | null, presented: string | undefined): boolean {
	if (!expected || !presented) return false;
	const expectedBytes = Buffer.from(expected, "utf8");
	const presentedBytes = Buffer.from(presented, "utf8");
	if (expectedBytes.length !== presentedBytes.length) return false;
	return timingSafeEqual(expectedBytes, presentedBytes);
}

/**
 * Authorizes an overlay runtime connection using only the stable overlay
 * capability and creator lifecycle. Dashboard sessions deliberately do not
 * participate in this boundary.
 */
export function evaluateOverlayRuntimeAccess<TOverlay extends OverlayRuntimeRecord>(input: { channel: OverlayRuntimeChannel; overlay: TOverlay | null; presentedSecret?: string; ownerSuspended: boolean; ownerDisabledReason?: string | null }): OverlayRuntimeDecision<TOverlay> {
	if (!input.overlay) return { allowed: false, reason: "not-found" };
	if (input.ownerSuspended) return { allowed: false, reason: "owner-suspended", overlay: input.overlay, ownerDisabledReason: input.ownerDisabledReason ?? null };
	if (input.channel === "websocket" && !secretsMatch(input.overlay.secret, input.presentedSecret)) return { allowed: false, reason: "invalid-secret" };
	return { allowed: true, overlay: input.overlay };
}

export function preserveOverlayRuntimeReference<TReference extends { url: string; secret: string }>(reference: TReference): TReference {
	return reference;
}
