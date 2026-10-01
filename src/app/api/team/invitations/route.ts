import { NextResponse } from "next/server";
import { createPersistedInvitation } from "@/auth/invitations";
import { getAuthSession } from "@/auth/session";
import { consumeDatabaseRateLimit } from "@/auth/rate-limit";

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		if (typeof body.organizationId !== "string" || typeof body.email !== "string" || typeof body.role !== "string" || (body.delivery !== "copy" && body.delivery !== "copy-and-email")) {
			return NextResponse.json({ error: "INVALID_INVITATION_REQUEST" }, { status: 400 });
		}
		const session = await getAuthSession(request.headers);
		if (!session) return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
		const network = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
		const limit = await consumeDatabaseRateLimit({ identityKey: session.user.id, networkKey: network, action: "team-invitation", limit: 10, windowMs: 60 * 60 * 1000, now: new Date() });
		if (!limit.allowed) return NextResponse.json({ error: limit.code, retryAfterSeconds: limit.retryAfterSeconds }, { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } });
		const { auth } = await import("@/auth/config");
		const organizations = await auth.api.listOrganizations({ headers: request.headers });
		const organization = organizations.find((candidate) => candidate.id === body.organizationId);
		if (!organization) return NextResponse.json({ error: "ACCESS_PATH_REQUIRED" }, { status: 403 });

		const result = await createPersistedInvitation({
			headers: request.headers,
			organizationId: body.organizationId,
			organizationName: organization.name,
			email: body.email,
			role: body.role,
			delivery: body.delivery,
		});
		return NextResponse.json({ invitationId: result.invitation.id, invitationUrl: result.invitationUrl, delivery: result.delivery });
	} catch {
		return NextResponse.json({ error: "INVITATION_NOT_CREATED" }, { status: 403 });
	}
}
