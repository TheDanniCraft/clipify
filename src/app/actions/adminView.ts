/* istanbul ignore file */
"use server";

import { db } from "@/db/client";
import { usersTable } from "@/db/schema";
import { clearAdminView, startAdminView, validateAdminAuth } from "@actions/auth";
import { count, desc, eq, ilike, or } from "drizzle-orm";

export type AdminViewCandidate = {
	id: string;
	username: string;
	role: string;
	plan: string;
};

export type AdminExplorerRow = {
	id: string;
	username: string;
	email: string;
	role: string;
	plan: string;
	lastLogin: Date | string | null;
};

export type AdminExplorerPage = {
	users: AdminExplorerRow[];
	page: number;
	totalPages: number;
	totalRows: number;
};

function toPositiveInt(value: number, fallback: number) {
	if (!Number.isFinite(value) || value < 1) return fallback;
	return Math.floor(value);
}

export async function getAdminViewCandidates(query: string): Promise<AdminViewCandidate[]> {
	const admin = await validateAdminAuth(true);
	if (!admin) return [];

	const q = query.trim();

	const rows =
		q.length > 0
			? await db
					.select({
						id: usersTable.id,
						username: usersTable.username,
						role: usersTable.role,
						plan: usersTable.plan,
					})
					.from(usersTable)
					.where(or(ilike(usersTable.username, `%${q}%`), eq(usersTable.id, q)))
					.orderBy(desc(usersTable.lastLogin), desc(usersTable.createdAt))
					.limit(20)
					.execute()
			: await db
					.select({
						id: usersTable.id,
						username: usersTable.username,
						role: usersTable.role,
						plan: usersTable.plan,
					})
					.from(usersTable)
					.orderBy(desc(usersTable.lastLogin), desc(usersTable.createdAt))
					.limit(20)
					.execute();

	return rows;
}

export async function switchAdminView(targetUserId: string) {
	return startAdminView(targetUserId);
}

export async function stopAdminView() {
	return clearAdminView();
}

export async function getAdminExplorerPage(query: string, requestedPage = 1, pageSize = 25): Promise<AdminExplorerPage> {
	const admin = await validateAdminAuth(true);
	if (!admin) {
		return {
			users: [],
			page: 1,
			totalPages: 1,
			totalRows: 0,
		};
	}

	const q = query.trim();
	const safePageSize = toPositiveInt(pageSize, 25);
	const filter = q.length > 0 ? or(ilike(usersTable.username, `%${q}%`), eq(usersTable.id, q)) : undefined;
	const totalRowsRaw = filter ? await db.select({ count: count() }).from(usersTable).where(filter).execute() : await db.select({ count: count() }).from(usersTable).execute();
/* istanbul ignore next */
	const totalRows = Number(totalRowsRaw[0]?.count ?? 0);
	const totalPages = Math.max(1, Math.ceil(totalRows / safePageSize));
	const page = Math.min(toPositiveInt(requestedPage, 1), totalPages);
	const offset = (page - 1) * safePageSize;
	const users = filter
		? await db
				.select({
					id: usersTable.id,
					username: usersTable.username,
					email: usersTable.email,
					role: usersTable.role,
					plan: usersTable.plan,
					lastLogin: usersTable.lastLogin,
				})
				.from(usersTable)
				.where(filter)
				.orderBy(desc(usersTable.lastLogin), desc(usersTable.createdAt))
				.limit(safePageSize)
				.offset(offset)
				.execute()
		: await db
				.select({
					id: usersTable.id,
					username: usersTable.username,
					email: usersTable.email,
					role: usersTable.role,
					plan: usersTable.plan,
					lastLogin: usersTable.lastLogin,
				})
				.from(usersTable)
				.orderBy(desc(usersTable.lastLogin), desc(usersTable.createdAt))
				.limit(safePageSize)
				.offset(offset)
				.execute();

	return {
		users,
		page,
		totalPages,
		totalRows,
	};
}


