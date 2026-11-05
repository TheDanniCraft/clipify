"use server";
import { randomUUID } from "node:crypto";
import { and, eq, or, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { userContentStatesTable } from "@/db/schema";
import { authorizeCreatorOperation } from "@/auth/authorize-operation";
import { getCreatorClipDetail } from "./creatorLibrary";
import { compositionSchema, convertLegacyClipLayout, type ClipComposition } from "@lib/clipComposition";
import { clipLayoutSchema } from "@lib/clipLayout";
const prefix = "clip-layout-template:v2:",
	overridePrefix = "clip-layout-override:v2:",
	defaultPrefix = "clip-layout-default:v2:",
	legacyKey = "clip-portrait-layout:v1";
const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/);
const templateSchema = z.object({ name: z.string().trim().min(1).max(80), composition: compositionSchema });
export type ClipLayoutTemplate = { id: string; name: string; composition: ClipComposition; updatedAt: string };
const validCreator = (id: string) => typeof id === "string" && id.length > 0 && id.length <= 200;
async function store(creatorId: string, contentKey: string, value: unknown) {
	const state = JSON.stringify(value),
		updatedAt = new Date();
	await db
		.insert(userContentStatesTable)
		.values({ userId: creatorId, contentKey, state, updatedAt })
		.onConflictDoUpdate({ target: [userContentStatesTable.userId, userContentStatesTable.contentKey], set: { state, updatedAt } })
		.execute();
}
async function template(creatorId: string, id: string) {
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
		templates.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
		const defaults: Partial<Record<ClipComposition["format"], string>> = {};
		for (const format of ["desktop", "mobile"] as const) {
			const row = rows.find((row) => row.contentKey === defaultPrefix + format);
			const id = row ? z.object({ id: idSchema }).parse(JSON.parse(row.state)).id : format === "mobile" && legacy ? "legacy" : undefined;
			if (templates.some((entry) => entry.id === id && entry.composition.format === format)) defaults[format] = id;
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
		if (parsed.data.id) {
			const previous = await template(creatorId, parsed.data.id);
			if (!previous) return { ok: false as const, code: "NOT_FOUND" };
			if (previous.composition.format !== parsed.data.composition.format) return { ok: false as const, code: "INVALID_INPUT" };
		}
		const id = parsed.data.id ?? randomUUID();
		await store(creatorId, prefix + id, { name: parsed.data.name, composition: parsed.data.composition });
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
		await store(creatorId, defaultPrefix + entry.composition.format, { id });
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
	const detail = await getCreatorClipDetail({ creatorId, clipId });
	if (!detail.ok) return { ok: false as const, code: detail.code };
	const entry = await template(creatorId, id);
	return entry ? { ok: true as const, entry } : { ok: false as const, code: "NOT_FOUND" };
}
export async function loadClipLayoutOverride(creatorId: string, id: string, clipId: string) {
	try {
		const access = await clipAccess(creatorId, id, clipId, false);
		if (!access.ok) return access;
		const [row] = await db
			.select({ state: userContentStatesTable.state })
			.from(userContentStatesTable)
			.where(and(eq(userContentStatesTable.userId, creatorId), eq(userContentStatesTable.contentKey, overridePrefix + id + ":" + clipId)))
			.execute();
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
		if (parsed.data.format !== access.entry.composition.format) return { ok: false as const, code: "INVALID_INPUT" };
		await store(creatorId, overridePrefix + id + ":" + clipId, { composition: parsed.data });
		return { ok: true as const };
	} catch {
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" };
	}
}
export async function resetClipLayoutOverride(creatorId: string, id: string, clipId: string) {
	try {
		const access = await clipAccess(creatorId, id, clipId, true);
		if (!access.ok) return access;
		await db
			.delete(userContentStatesTable)
			.where(and(eq(userContentStatesTable.userId, creatorId), eq(userContentStatesTable.contentKey, overridePrefix + id + ":" + clipId)))
			.execute();
		return { ok: true as const };
	} catch {
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" };
	}
}
