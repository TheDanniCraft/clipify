import { and, eq, gt } from "drizzle-orm";
import { invitation, organization } from "@/db/auth-schema";
import { agencyAccountsTable } from "@/db/schema";
import { db } from "@/db/client";
import InvitationAcceptance from "./invitation-acceptance";

export const dynamic = "force-dynamic";

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ invitationId?: string | string[] }> }) {
	const invitationId = (await searchParams).invitationId;
	const id = typeof invitationId === "string" ? invitationId : "";
	const rows = id
		? await db
				.select({ invitation, organizationName: organization.name, agencyOrganizationId: agencyAccountsTable.organizationId })
				.from(invitation)
				.innerJoin(organization, eq(invitation.organizationId, organization.id))
				.leftJoin(agencyAccountsTable, eq(invitation.organizationId, agencyAccountsTable.organizationId))
				.where(and(eq(invitation.id, id), eq(invitation.status, "pending"), gt(invitation.expiresAt, new Date())))
				.limit(1)
		: [];
	const preview = rows[0];

	return (
		<InvitationAcceptance
			invitation={
				preview
					? {
							id: preview.invitation.id,
							email: preview.invitation.email,
							organizationId: preview.invitation.organizationId,
							organizationName: preview.organizationName,
							isAgency: Boolean(preview.agencyOrganizationId),
						}
					: null
			}
		/>
	);
}
