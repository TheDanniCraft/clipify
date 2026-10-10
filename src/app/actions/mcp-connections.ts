"use server";
import { headers } from "next/headers";
import { auth } from "@/auth/config";
import { listMcpConnections, revokeMcpConnection, purgeInactiveMcpConnections } from "@/server/mcp/connections";
import { getMcpConfiguration } from "@/server/mcp/config";

export async function getConnectedMcpApps() {
	if (!getMcpConfiguration().valid) return { connections: [] };
	try {
		return { connections: await listMcpConnections({ auth, headers: new Headers(await headers()) }) };
	} catch {
		return { connections: [], error: "Connected apps could not be loaded. Try again." };
	}
}
export async function revokeConnectedMcpApp(grantId: string): Promise<{ revoked?: boolean; cleanupPending?: boolean; error?: string }> {
	const configuration = getMcpConfiguration();
	if (!configuration.valid) return { error: "Connected apps are unavailable." };
	try {
		const response = await revokeMcpConnection({ auth, headers: new Headers(await headers()), origin: configuration.origin, grantId });
		if (!response.ok) return { error: "Access could not be revoked. Try again." };
		return await response.json();
	} catch {
		return { error: "Access could not be revoked. Try again." };
	}
}

export async function getMcpActivityCreators(): Promise<{ available: boolean; creators: { id: string; name: string }[]; error?: string }> {
	if (!getMcpConfiguration().valid) return { available: false, creators: [] };
	try {
		const requestHeaders = new Headers(await headers());
		const { getVerifiedSessionPrincipal } = await import("@/auth/session-principal");
		const principal = await getVerifiedSessionPrincipal(requestHeaders);
		if (!principal) return { available: true, creators: [], error: "Sign in to view AI app activity." };
		const { listAuthorizedCreatorOperations } = await import("@/auth/authorize-operation");
		const access = await listAuthorizedCreatorOperations({ permission: "audit:read", requestHeaders });
		return { available: true, creators: access.map(({ creator }) => ({ id: creator.id, name: creator.username })) };
	} catch {
		return { available: true, creators: [], error: "Creator activity access could not be loaded. Refresh and try again." };
	}
}

export async function getConnectedMcpActivityPage(input: unknown): Promise<import("@lib/mcpConnection").McpActivityPage & { error?: string }> {
	if (!getMcpConfiguration().valid) return { items: [], nextCursor: null, error: "AI app activity is unavailable." };
	try {
		const { getVerifiedSessionPrincipal } = await import("@/auth/session-principal");
		const principal = await getVerifiedSessionPrincipal(new Headers(await headers()));
		if (!principal) return { items: [], nextCursor: null, error: "Sign in to view AI app activity." };
		const { listMcpActivity } = await import("@/server/mcp/activity");
		return await listMcpActivity(principal, input);
	} catch (error) {
		return { items: [], nextCursor: null, error: error instanceof Error && error.message === "ACCESS_DENIED" ? "Activity is unavailable for this creator. Your access may have changed." : "Activity could not be loaded. Refresh and try again." };
	}
}

export async function purgeInactiveConnectedMcpApps(): Promise<{ purgedIds?: string[]; error?: string }> {
	const configuration = getMcpConfiguration();
	if (!configuration.valid) return { error: "Connected apps are unavailable." };
	try {
		const response = await purgeInactiveMcpConnections({ auth, headers: new Headers(await headers()), origin: configuration.origin });
		if (!response.ok) return { error: "Inactive connections could not be purged. Try again." };
		return await response.json();
	} catch {
		return { error: "Inactive connections could not be purged. Try again." };
	}
}
