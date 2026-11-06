"use server";
import { randomUUID } from "node:crypto";
import { and, eq, or, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { userContentStatesTable } from "@/db/schema";
import { authorizeCreatorOperation } from "@/auth/authorize-operation";
import { getCreatorClipDetail } from "./creatorLibrary";
import { compositionSchema, convertLegacyClipLayout, type ClipComposition } from "@lib/clipComposition";
import { templateCompositions, templateCompositionsSchema } from "@lib/clipLayoutTemplate";
import { clipLayoutSchema } from "@lib/clipLayout";
const prefix = "clip-layout-template:v2:",
	overridePrefix = "clip-layout-override:v2:",
	defaultPrefix = "clip-layout-default:v2:",
	legacyKey = "clip-portrait-layout:v1";
const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/);
const templateSchema = z.object({ name: z.string().trim().min(1).max(80), composition: compositionSchema, compositions: templateCompositionsSchema.optional(), referenceClipId: idSchema.nullable().optional() });
export type ClipLayoutTemplate = { id: string; name: string; composition: ClipComposition; compositions?: z.infer<typeof templateCompositionsSchema>; referenceClipId?: string | null; updatedAt: string };
const validCreator = (id: string) => typeof id === "string" && id.length > 0 && id.length <= 200;
async function store(creatorId: string, contentKey: string, value: unknown, format?: ClipComposition["format"]) {
	const state = JSON.stringify(value),
		updatedAt = new Date();
	// Merge the edited format in PostgreSQL so concurrent tabs preserve its counterpart.
	const storedState = format ? sql`jsonb_set(${state}::jsonb, '{compositions}', coalesce(${userContentStatesTable.state}::jsonb->'compositions', (${state}::jsonb->'compositions') || jsonb_build_object(${userContentStatesTable.state}::jsonb->'composition'->>'format', ${userContentStatesTable.state}::jsonb->'composition')) || jsonb_build_object(${format}::text, ${state}::jsonb->'composition'))::text` : state;
	await db
		.insert(userContentStatesTable)
		.values({ userId: creatorId, contentKey, state, updatedAt })
		.onConflictDoUpdate({ target: [userContentStatesTable.userId, userContentStatesTable.contentKey], set: { state: storedState, updatedAt } })
		.execute();
}
async function template(creatorId: string, id: string): Promise<z.infer<typeof templateSchema> | null> {
	const keys = id === "legacy" ? [prefix + id, legacyKey] : [prefix + id];
	const rows = await db
		.select({ contentKey: userContentStatesTable.contentKey, state: userContentStatesTable.state })
		.from(userContentStatesTable)
		.where(and(eq(userContentStatesTable.userId, creatorId), inArray(userContentStatesTable.contentKey, keys)))
		.execute();
	const row = rows.find((row) => row.contentKey === prefix + id);
	if (row) return templateSchema.parse(JSON.parse(row.state));
	const legacy = rows.find((row) => row.contentKey === legacyKey);
	if (legacy) return { name: "Saved Mobile layout", composition: convertLegacyClipLayout(clipLayoutSchema.parse(JSON.parse(legacy.state))) };
	return null;
}
export async function listClipLayouts(creatorId: string) {
	if (!validCreator(creatorId)) return { ok: false as const, code: "INVALID_INPUT" };
	const grant = await authorizeCreatorOperation({ creatorId, resourceOwnerId: creatorId, permission: "creator:read" });
	if (!grant.allowed) return { ok: false as const, code: grant.code };
	try {
		const rows = await db
			.select({ contentKey: userContentStatesTable.contentKey, state: userContentStatesTable.state, updatedAt: userContentStatesTable.updatedAt })
			.from(userContentStatesTable)
			.where(and(eq(userContentStatesTable.userId, creatorId), or(sql`starts_with(${userContentStatesTable.contentKey},${prefix})`, sql`starts_with(${userContentStatesTable.contentKey},${defaultPrefix})`, eq(userContentStatesTable.contentKey, legacyKey))))
			.execute();
		const templates: ClipLayoutTemplate[] = rows.filter((row) => row.contentKey.startsWith(prefix)).map((row) => ({ id: row.contentKey.slice(prefix.length), ...templateSchema.parse(JSON.parse(row.state)), updatedAt: row.updatedAt.toISOString() }));
		const legacy = rows.find((row) => row.contentKey === legacyKey);
		if (legacy && !templates.some((entry) => entry.id === "legacy")) templates.unshift({ id: "legacy", name: "Saved Mobile layout", composition: convertLegacyClipLayout(clipLayoutSchema.parse(JSON.parse(legacy.state))), updatedAt: legacy.updatedAt.toISOString() });
		for (const entry of templates) entry.compositions = templateCompositions(entry);
		templates.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
		const defaults: Partial<Record<ClipComposition["format"], string>> = {};
		for (const format of ["desktop", "mobile"] as const) {
			const row = rows.find((row) => row.contentKey === defaultPrefix + "template") ?? rows.find((row) => row.contentKey === defaultPrefix + format);
			const id = row ? z.object({ id: idSchema }).parse(JSON.parse(row.state)).id : format === "mobile" && legacy ? "legacy" : undefined;
			if (templates.some((entry) => entry.id === id)) defaults[format] = id;
		}
		return { ok: true as const, templates, defaults };
	} catch {
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" };
	}
}
export async function saveClipLayoutTemplate(creatorId: string, input: unknown) {
	const parsed = templateSchema.extend({ id: idSchema.optional() }).safeParse(input);
	if (!validCreator(creatorId) || !parsed.success) return { ok: false as const, code: "INVALID_INPUT" };
	const grant = await authorizeCreatorOperation({ creatorId, resourceOwnerId: creatorId, permission: "creator:update" });
	if (!grant.allowed) return { ok: false as const, code: grant.code };
	try {
		const previous = parsed.data.id ? await template(creatorId, parsed.data.id) : null;
		if (parsed.data.id) {
			if (!previous) return { ok: false as const, code: "NOT_FOUND" };
		}
		const id = parsed.data.id ?? randomUUID();
		const compositions = { ...templateCompositions(previous ?? parsed.data), [parsed.data.composition.format]: parsed.data.composition };
		await store(creatorId, prefix + id, { name: parsed.data.name, composition: parsed.data.composition, compositions, referenceClipId: parsed.data.referenceClipId === undefined ? previous?.referenceClipId : parsed.data.referenceClipId }, parsed.data.composition.format);
		return { ok: true as const, id };
	} catch {
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" };
	}
}
export async function setDefaultClipLayout(creatorId: string, id: string) {
	if (!validCreator(creatorId) || !idSchema.safeParse(id).success) return { ok: false as const, code: "INVALID_INPUT" };
	const grant = await authorizeCreatorOperation({ creatorId, resourceOwnerId: creatorId, permission: "creator:update" });
	if (!grant.allowed) return { ok: false as const, code: grant.code };
	try {
		const entry = await template(creatorId, id);
		if (!entry) return { ok: false as const, code: "NOT_FOUND" };
		await store(creatorId, defaultPrefix + "template", { id });
		return { ok: true as const };
	} catch {
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" };
	}
}
export async function deleteClipLayoutTemplate(creatorId: string, id: string) {
	if (!validCreator(creatorId) || !idSchema.safeParse(id).success) return { ok: false as const, code: "INVALID_INPUT" };
	const grant = await authorizeCreatorOperation({ creatorId, resourceOwnerId: creatorId, permission: "creator:update" });
	if (!grant.allowed) return { ok: false as const, code: grant.code };
	try {
		await db
			.delete(userContentStatesTable)
			.where(and(eq(userContentStatesTable.userId, creatorId), or(inArray(userContentStatesTable.contentKey, id === "legacy" ? [prefix + id, legacyKey] : [prefix + id]), sql`starts_with(${userContentStatesTable.contentKey},${overridePrefix + id + ":"})`)))
			.execute();
		return { ok: true as const };
	} catch {
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" };
	}
}
async function clipAccess(creatorId: string, id: string, clipId: string, write: boolean) {
	if (!validCreator(creatorId) || !idSchema.safeParse(id).success || !idSchema.safeParse(clipId).success) return { ok: false as const, code: "INVALID_INPUT" };
	const grant = await authorizeCreatorOperation({ creatorId, resourceOwnerId: creatorId, permission: write ? "clips:export" : "creator:read" });
	if (!grant.allowed) return { ok: false as const, code: grant.code };
	const detail = await getCreatorClipDetail({ creatorId, clipId, cachedOnly: true });
	if (!detail.ok) return { ok: false as const, code: detail.code };
	const entry = await template(creatorId, id);
	return entry ? { ok: true as const, entry } : { ok: false as const, code: "NOT_FOUND" };
}
export async function loadClipLayoutOverride(creatorId: string, id: string, clipId: string, format?: "desktop" | "mobile") {
	if (format !== undefined && format !== "desktop" && format !== "mobile") return { ok: false as const, code: "INVALID_INPUT" };
	try {
		const access = await clipAccess(creatorId, id, clipId, false);
		if (!access.ok) return access;
		const targetFormat = format ?? access.entry.composition.format;
		const rows = await db
			.select({ contentKey: userContentStatesTable.contentKey, state: userContentStatesTable.state })
			.from(userContentStatesTable)
			.where(and(eq(userContentStatesTable.userId, creatorId), inArray(userContentStatesTable.contentKey, [overridePrefix + id + ":" + clipId + ":" + targetFormat, overridePrefix + id + ":" + clipId])))
			.execute();
		const row = rows.find((row) => row.contentKey?.endsWith(":" + targetFormat)) ?? rows.find((row) => compositionSchema.parse(JSON.parse(row.state).composition).format === targetFormat);
		const composition = row ? compositionSchema.parse(JSON.parse(row.state).composition) : null;
		return { ok: true as const, composition };
	} catch {
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" };
	}
}
export async function saveClipLayoutOverride(creatorId: string, id: string, clipId: string, input: unknown) {
	const parsed = compositionSchema.safeParse(input);
	if (!parsed.success) return { ok: false as const, code: "INVALID_INPUT" };
	try {
		const access = await clipAccess(creatorId, id, clipId, true);
		if (!access.ok) return access;

		await store(creatorId, overridePrefix + id + ":" + clipId + ":" + parsed.data.format, { composition: parsed.data });
		return { ok: true as const };
	} catch {
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" };
	}
}
export async function resetClipLayoutOverride(creatorId: string, id: string, clipId: string, format?: "desktop" | "mobile") {
	if (format !== undefined && format !== "desktop" && format !== "mobile") return { ok: false as const, code: "INVALID_INPUT" };
	try {
		const access = await clipAccess(creatorId, id, clipId, true);
		if (!access.ok) return access;
		await db
			.delete(userContentStatesTable)
			.where(and(eq(userContentStatesTable.userId, creatorId), or(eq(userContentStatesTable.contentKey, overridePrefix + id + ":" + clipId + ":" + (format ?? access.entry.composition.format)), and(eq(userContentStatesTable.contentKey, overridePrefix + id + ":" + clipId), sql`${userContentStatesTable.state}::jsonb->'composition'->>'format' = ${format ?? access.entry.composition.format}`))))
			.execute();
		return { ok: true as const };
	} catch {
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" };
	}
}
