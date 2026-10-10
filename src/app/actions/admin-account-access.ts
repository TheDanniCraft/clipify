"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { validateAdminAuth } from "@actions/auth";
import { db } from "@/db/client";
import { auditEventsTable, overlaysTable, usersTable } from "@/db/schema";
import { StatusOptions } from "@/app/lib/types";
import { queueAccountAccessEmail } from "@/server/notifications/account-access-events";

export async function setAdminAccountAccess(input: { userId: string; disabled: boolean; reason?: string }) {
	const admin = await validateAdminAuth(true);
	if (!admin) throw new Error("ADMIN_REQUIRED");
	if (typeof input.userId !== "string" || typeof input.disabled !== "boolean") throw new Error("INVALID_ACCOUNT_ACCESS_REQUEST");
	const reason = typeof input.reason === "string" ? input.reason.trim() : "";
	if (input.disabled && (!reason || reason.length > 500)) throw new Error("DISABLE_REASON_REQUIRED");
	if (input.disabled && input.userId === admin.id) throw new Error("CANNOT_DISABLE_OWN_ACCOUNT");
	const correlationId = randomUUID();
	const target = await db.transaction(async (tx) => {
		const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, input.userId)).for("update");
		if (!user) throw new Error("USER_NOT_FOUND");
		if (user.disabled === input.disabled) return null;
		const now = new Date();
		await tx
			.update(usersTable)
			.set({ disabled: input.disabled, disableType: input.disabled ? "manual" : null, disabledAt: input.disabled ? now : null, disabledReason: input.disabled ? reason : null, updatedAt: now })
			.where(eq(usersTable.id, user.id));
		if (input.disabled) await tx.update(overlaysTable).set({ status: StatusOptions.Paused, updatedAt: now }).where(eq(overlaysTable.ownerId, user.id));
		await tx.insert(auditEventsTable).values({ targetType: "user", targetId: user.id, action: input.disabled ? "account.disable" : "account.enable", outcome: "success", correlationId, metadata: { administratorId: admin.id, disabled: input.disabled } });
		await queueAccountAccessEmail({ userId: user.id, email: user.email, name: user.username, disabled: input.disabled, reason, changedAt: now }, tx);
		return user;
	});
	if (!target) return { changed: false, notificationQueued: false };
	return { changed: true, notificationQueued: true };
}
