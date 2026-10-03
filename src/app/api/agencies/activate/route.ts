import { NextResponse } from "next/server";
import { activateCurrentInvitedAgency } from "@/server/agencies/database";

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as { organizationId?: unknown };
		if (typeof body.organizationId !== "string" || !body.organizationId) return NextResponse.json({ error: "ORGANIZATION_REQUIRED" }, { status: 400 });
		return NextResponse.json(await activateCurrentInvitedAgency({ organizationId: body.organizationId }));
	} catch (error) {
		const message = error instanceof Error ? error.message : "AGENCY_ACTIVATION_FAILED";
		return NextResponse.json({ error: message }, { status: message === "AUTHENTICATION_REQUIRED" ? 401 : 403 });
	}
}
