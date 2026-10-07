import "server-only";
import { eq } from "drizzle-orm";
import { settingsTable, usersTable } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import type { DatabaseClient } from "@/db/client";
import { workflowOperation, type WorkflowContext } from "./workflow";
import { getMcpConfiguration } from "@/server/mcp/config";
import { resolveCreatorPageVisibility } from "@lib/creatorPage";
async function pageRow(context: WorkflowContext, lock = false) {
	const query = context.tx.select().from(settingsTable).where(eq(settingsTable.id, context.creatorId)).limit(1);
	return (await (lock ? query.for("update") : query))[0];
}
async function pageResult(context: WorkflowContext, row?: typeof settingsTable.$inferSelect) {
	const [creator] = await context.tx.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, context.creatorId)).limit(1);
	if (!creator) throw new Error("RESOURCE_UNAVAILABLE");
	const settings = { creatorPageEnabled: row?.creatorPageEnabled ?? true, creatorPageVisibility: resolveCreatorPageVisibility(row ?? { showOnCommunityPage: false }), creatorPageShowBio: row?.creatorPageShowBio ?? true, creatorPageSocialTitle: row?.creatorPageSocialTitle ?? null, creatorPageSocialDescription: row?.creatorPageSocialDescription ?? null };
	return { creatorId: context.creatorId, configurationRevision: row?.configurationRevision ?? 1, settings, publicUrl: `${getMcpConfiguration().origin}/creators/${encodeURIComponent(creator.username)}`, published: settings.creatorPageEnabled, capabilities: { socialPreview: context.pro }, effectiveSocialPreview: { title: context.pro ? settings.creatorPageSocialTitle : null, description: context.pro ? settings.creatorPageSocialDescription : null } };
}
export function getCreatorPageSettings(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(principal, "get_creator_page", input, async (_, context) => pageResult(context, await pageRow(context)), client);
}

import { nextConfigurationRevision } from "./revisions";
import type { z } from "zod";
import type { workflowInputSchemas } from "@/server/mcp/workflows/schemas";
type PagePatch = z.infer<typeof workflowInputSchemas.update_creator_page>["patch"] & { creatorPageEnabled?: boolean };
async function persistPage(context: WorkflowContext, expectedRevision: number, patch: PagePatch) {
	const current = await pageRow(context, true);
	const revision = nextConfigurationRevision(current?.configurationRevision ?? 1, expectedRevision);
	if (!context.pro) for (const key of ["creatorPageSocialTitle", "creatorPageSocialDescription"] as const) if (patch[key] !== undefined && patch[key] !== current?.[key] && !(patch[key] === null && !current?.[key])) throw new Error("FEATURE_RESTRICTED");
	context.assertCurrent();
	const [saved] = await context.tx
		.insert(settingsTable)
		.values({ id: context.creatorId, ...patch, configurationRevision: revision })
		.onConflictDoUpdate({ target: settingsTable.id, set: { ...patch, configurationRevision: revision } })
		.returning();
	return pageResult(context, saved);
}
export function updateCreatorPageSettings(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(principal, "update_creator_page", input, (input, context) => persistPage(context, input.expectedRevision, input.patch), client);
}

export function publishCreatorPage(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(principal, "publish_creator_page", input, (input, context) => persistPage(context, input.expectedRevision, { creatorPageEnabled: input.enabled }), client);
}
