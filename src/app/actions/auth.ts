"use server";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { AuthenticatedUser, Role } from "@types";
import { cookies } from "next/headers";
import { getBaseUrl } from "@actions/utils";
import { resolveUserEntitlements } from "@lib/entitlements";
import { db } from "@/db/client";
import { adminImpersonationSessionsTable, usersTable } from "@/db/schema";
import { and, eq, isNull, lt } from "drizzle-orm";

const AUTH_COOKIE_NAME = "token";
const ADMIN_VIEW_COOKIE_NAME = "admin_view";
const ADMIN_VIEW_SESSION_COOKIE_NAME = "admin_view_session";
const ADMIN_VIEW_ISSUER = "clipify-admin-view";
const ADMIN_VIEW_TTL_SECONDS = 60 * 60;

function getAdminViewSessionExpiryCutoffDate() {
	return new Date(Date.now() - ADMIN_VIEW_TTL_SECONDS * 1000);
}

type AdminViewPayload = {
	adminUserId: string;
	targetUserId: string;
	iat?: number;
	exp?: number;
};

export async function getCookie(name: string) {
	const cookieStore = await cookies();
	const cookie = cookieStore.get(name);

	if (!cookie) {
		return null;
	}

	return cookie.value;
}

export async function getUserFromCookie(cookie: string) {
	try {
		const decodedToken = jwt.verify(cookie, process.env.JWT_SECRET!, {
			algorithms: ["HS256"],
			issuer: "clipify",
		});

		return decodedToken as AuthenticatedUser;
	} catch {
		return undefined;
	}
}

export async function authUser(returnUrl?: string, error?: string, errorCode?: string) {
	const url = await getBaseUrl();

	const appUrl = new URL("/login", url);
	if (error) {
		appUrl.searchParams.set("error", error);
		appUrl.searchParams.set("errorCode", errorCode || "");
	}
	if (returnUrl) {
		appUrl.searchParams.set("returnUrl", returnUrl);
	}

	return NextResponse.redirect(appUrl);
}

export async function validateAuth(skipUserCheck = false) {
	const cookieStore = await cookies();
	const token = cookieStore.get(AUTH_COOKIE_NAME);
	const cookieUser = token ? ((await getUserFromCookie(token.value)) as AuthenticatedUser | null) : null;

	if (!cookieUser) {
		return false;
	}

	const actorUser = await getUserById(cookieUser.id);
	if (!actorUser) {
		return false;
	}

	const { effectiveUser, adminView } = await resolveEffectiveUser(actorUser, cookieStore);

	if (skipUserCheck) {
		return adminView ? { ...effectiveUser, adminView } : effectiveUser;
	}

	const { verifyToken } = await import("@actions/twitch");
	const effectiveUserTokenValid = await verifyToken(effectiveUser);
	if (!effectiveUserTokenValid) {
		if (adminView) {
			await clearAdminViewCookie(cookieStore);

			if (!(await verifyToken(actorUser))) {
				return false;
			}

			const actorEntitlements = await resolveUserEntitlements(actorUser);
			return { ...actorUser, entitlements: actorEntitlements };
		}

		return false;
	}

	const entitlements = await resolveUserEntitlements(effectiveUser);
	const enrichedUser = { ...effectiveUser, entitlements };

	return adminView ? { ...enrichedUser, adminView } : enrichedUser;
}

export async function validateAdminAuth(skipUserCheck = false) {
	const cookieStore = await cookies();
	const token = cookieStore.get(AUTH_COOKIE_NAME);
	const cookieUser = token ? ((await getUserFromCookie(token.value)) as AuthenticatedUser | null) : null;

	if (!cookieUser) {
		return false;
	}

	const adminUser = await getUserById(cookieUser.id);
	if (!adminUser || adminUser.role !== Role.Admin) {
		await clearAdminViewCookie(cookieStore);
		return false;
	}

	if (skipUserCheck) {
		return adminUser;
	}

	const { verifyToken } = await import("@actions/twitch");
	if (!(await verifyToken(adminUser))) {
		return false;
	}

	const entitlements = await resolveUserEntitlements(adminUser);
	return { ...adminUser, entitlements };
}

export async function startAdminView(targetUserId: string): Promise<{ ok: boolean; error?: "unauthorized" | "invalid_target" | "not_found" }> {
	const cookieStore = await cookies();
	const adminUser = await validateAdminAuth(true);
	if (!adminUser) {
		return { ok: false, error: "unauthorized" };
	}

	const targetId = targetUserId.trim();
	if (!targetId) {
		return { ok: false, error: "invalid_target" };
	}

	if (targetId === adminUser.id) {
		await clearAdminViewCookie(cookieStore);
		return { ok: true };
	}

	const target = await getUserById(targetId);
	if (!target) {
		return { ok: false, error: "not_found" };
	}

	const payload: AdminViewPayload = {
		adminUserId: adminUser.id,
		targetUserId: target.id,
	};
	await closeAdminViewSession(cookieStore);
	const value = jwt.sign(payload, process.env.JWT_SECRET!, {
		expiresIn: ADMIN_VIEW_TTL_SECONDS,
		algorithm: "HS256",
		issuer: ADMIN_VIEW_ISSUER,
	});

	cookieStore.set(ADMIN_VIEW_COOKIE_NAME, value, {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		maxAge: ADMIN_VIEW_TTL_SECONDS,
		path: "/",
	});
	await startAdminViewSession(cookieStore, adminUser.id, target.id);

	return { ok: true };
}

export async function clearAdminView() {
	const cookieStore = await cookies();
	await clearAdminViewCookie(cookieStore);
}

async function getUserById(userId: string): Promise<AuthenticatedUser | null> {
	const rows = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1).execute();
	return rows[0] || null;
}

async function resolveEffectiveUser(actorUser: AuthenticatedUser, cookieStore: Awaited<ReturnType<typeof cookies>>) {
	if (actorUser.role !== Role.Admin) {
		await clearAdminViewCookie(cookieStore);
		return { effectiveUser: actorUser, adminView: undefined as AuthenticatedUser["adminView"] };
	}

	const adminViewPayload = await getAdminViewPayload(actorUser.id, cookieStore);
	if (!adminViewPayload) {
		return { effectiveUser: actorUser, adminView: undefined as AuthenticatedUser["adminView"] };
	}

	if (adminViewPayload.targetUserId === actorUser.id) {
		await clearAdminViewCookie(cookieStore);
		return { effectiveUser: actorUser, adminView: undefined as AuthenticatedUser["adminView"] };
	}

	const targetUser = await getUserById(adminViewPayload.targetUserId);
	if (!targetUser) {
		await clearAdminViewCookie(cookieStore);
		return { effectiveUser: actorUser, adminView: undefined as AuthenticatedUser["adminView"] };
	}

	return {
		effectiveUser: targetUser,
		adminView: {
			active: true as const,
			adminUserId: actorUser.id,
			adminUsername: actorUser.username,
		},
	};
}

async function getAdminViewPayload(adminUserId: string, cookieStore: Awaited<ReturnType<typeof cookies>>): Promise<AdminViewPayload | null> {
	const encoded = cookieStore.get(ADMIN_VIEW_COOKIE_NAME)?.value;
	if (!encoded) return null;

	try {
		const decoded = jwt.verify(encoded, process.env.JWT_SECRET!, {
			algorithms: ["HS256"],
			issuer: ADMIN_VIEW_ISSUER,
		});
		const payload = decoded as AdminViewPayload;
		if (!payload?.adminUserId || !payload?.targetUserId || payload.adminUserId !== adminUserId) {
			await clearAdminViewCookie(cookieStore);
			return null;
		}
		return payload;
	} catch {
		await clearAdminViewCookie(cookieStore);
		return null;
	}
}

async function clearAdminViewCookie(cookieStore: Awaited<ReturnType<typeof cookies>>) {
	await closeAdminViewSession(cookieStore);
	cookieStore.set(ADMIN_VIEW_COOKIE_NAME, "", {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		maxAge: 0,
		path: "/",
	});
}

async function closeAdminViewSession(cookieStore: Awaited<ReturnType<typeof cookies>>) {
	const sessionId = cookieStore.get(ADMIN_VIEW_SESSION_COOKIE_NAME)?.value;
	if (!sessionId) return;
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
		cookieStore.set(ADMIN_VIEW_SESSION_COOKIE_NAME, "", {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			maxAge: 0,
			path: "/",
		});
		return;
	}

	try {
		await db
			.update(adminImpersonationSessionsTable)
			.set({
				endedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(adminImpersonationSessionsTable.id, sessionId))
			.execute();
	} catch (error) {
		console.error("[admin-view] failed to close impersonation session", error);
	} finally {
		cookieStore.set(ADMIN_VIEW_SESSION_COOKIE_NAME, "", {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			maxAge: 0,
			path: "/",
		});
	}
}

async function startAdminViewSession(cookieStore: Awaited<ReturnType<typeof cookies>>, adminUserId: string, targetUserId: string) {
	try {
		await db
			.update(adminImpersonationSessionsTable)
			.set({
				endedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(and(isNull(adminImpersonationSessionsTable.endedAt), lt(adminImpersonationSessionsTable.startedAt, getAdminViewSessionExpiryCutoffDate())))
			.execute();

		const rows = await db
			.insert(adminImpersonationSessionsTable)
			.values({
				adminUserId,
				targetUserId,
			})
			.returning({ id: adminImpersonationSessionsTable.id })
			.execute();
		const sessionId = rows[0]?.id;
		if (!sessionId) return;

		cookieStore.set(ADMIN_VIEW_SESSION_COOKIE_NAME, sessionId, {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			maxAge: ADMIN_VIEW_TTL_SECONDS,
			path: "/",
		});
	} catch (error) {
		console.error("[admin-view] failed to start impersonation session", error);
	}
}

export async function clearAdminViewCookieForAuthFlow() {
	const cookieStore = await cookies();
	await clearAdminViewCookie(cookieStore);
}

export async function getAdminViewStatus() {
	const user = await validateAuth(true);
	if (!user) {
		return { active: false as const };
	}

	if (!user.adminView) {
		return { active: false as const };
	}

	return {
		active: true as const,
		adminUserId: user.adminView.adminUserId,
		adminUsername: user.adminView.adminUsername,
		targetUserId: user.id,
		targetUsername: user.username,
	};
}
