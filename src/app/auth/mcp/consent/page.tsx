import { verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { oauthClient } from "@/db/auth-schema";
import { listAuthorizedCreatorOperations } from "@/auth/authorize-operation";
import { approveMcpConsent } from "@/server/mcp/grants";
import { getMcpConfiguration } from "@/server/mcp/config";
import { MCP_SCOPES } from "@/server/mcp/scopes";
import { getAvatar } from "@/app/actions/twitch";
import { ConsentForm } from "./ConsentForm";

const creatorChoice = z.object({ creatorId: z.string().min(1).max(255), agencyOrganizationId: z.string().min(1).max(255).nullable(), scopes: z.array(z.string()).min(1).max(100) }).strict();

export default async function McpConsentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	const parameters = await searchParams;
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(parameters)) {
		if (Array.isArray(value)) {
			if (key !== "ba_param") return <p role='alert'>Invalid authorization request. Restart the connection from your app.</p>;
			for (const item of value) query.append(key, item);
			continue;
		}
		if (value !== undefined) query.set(key, value);
	}
	const oauthQuery = query.toString();
	const requestedScopes = (query.get("scope") ?? "").split(" ").filter(Boolean);
	if (!query.get("client_id") || !query.get("sig") || !requestedScopes.length || requestedScopes.some((scope) => ![...MCP_SCOPES, "offline_access"].includes(scope as (typeof MCP_SCOPES)[number]))) return <p role='alert'>Invalid authorization request. Restart the connection from your app.</p>;
	const secret = process.env.BETTER_AUTH_SECRET;
	if (!secret || !(await verifyOAuthQueryParams(oauthQuery, secret))) return <p role='alert'>Invalid authorization request. Restart the connection from your app.</p>;
	const requestHeaders = await headers();
	const session = await auth.api.getSession({ headers: requestHeaders });
	if (!session) redirect(`/login?returnUrl=${encodeURIComponent(`/auth/mcp/consent?${oauthQuery}`)}`);
	const [clients, decisions] = await Promise.all([
		db
			.select({ name: oauthClient.name })
			.from(oauthClient)
			.where(eq(oauthClient.clientId, query.get("client_id")!))
			.limit(1),
		listAuthorizedCreatorOperations({ permission: "creator:read", requestHeaders }),
	]);
	const creators = await Promise.all(decisions.map(async (decision) => ({ creatorId: decision.creator.id, name: decision.creator.username, avatarUrl: await getAvatar(decision.creator.id, session.user.id).catch(() => undefined), agencyOrganizationId: decision.accessPath === "agency" ? ((session.session as typeof session.session & { activeOrganizationId?: string | null }).activeOrganizationId ?? null) : null })));
	async function submitConsent(data: FormData): Promise<{ error?: string; callbackUrl?: string; authorized?: boolean } | void> {
		"use server";
		const incomingHeaders = new Headers(await headers());
		incomingHeaders.set("Content-Type", "application/json");
		const accept = data.get("accept") === "true";
		let selectedCreators: z.infer<typeof creatorChoice>[];
		try {
			selectedCreators = accept ? data.getAll("creators").map((value) => creatorChoice.parse(JSON.parse(String(value)))) : [];
		} catch {
			return { error: "Choose valid creators and try again." };
		}
		const response = await approveMcpConsent({ auth, origin: getMcpConfiguration().origin, headers: incomingHeaders, oauthQuery, accept, scopes: data.getAll("scopes").map(String), creators: selectedCreators });
		const result = await response.json().catch(() => null);
		if (!response.ok || typeof result?.url !== "string") return { error: "The connection could not be approved. Restart the connection from your app." };
		// The provider validates the signed state and registered callback before returning this URL.
		return { callbackUrl: result.url, authorized: accept };
	}
	return <ConsentForm clientName={clients[0]?.name || "this app"} requestedScopes={requestedScopes} creators={creators} oauthQuery={oauthQuery} action={submitConsent} />;
}
