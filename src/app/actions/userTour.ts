"use server";
import { validateAuth } from "@actions/auth";
import { isGuideEvent } from "@lib/userTour";
import { applyUserTourEvent, loadUserTourProgress } from "@/server/user-tour/progress";

export async function saveUserTourEvent(expectedAccountId: string, event: unknown) {
	const user = await validateAuth(true);
	if (!user || user.id !== expectedAccountId || !isGuideEvent(event) || ("ownerId" in event && event.ownerId !== user.id)) return { ok: false as const };
	await applyUserTourEvent(user.id, event);
	return { ok: true as const, accountId: user.id };
}

export async function getUserTourProgress(expectedAccountId: string) {
	const user = await validateAuth(true);
	if (!user || user.id !== expectedAccountId) return null;
	return loadUserTourProgress(user.id);
}
