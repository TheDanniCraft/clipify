"use server";

import { db } from "@/db/client";
import { usersTable } from "@/db/schema";
import { clearAdminView, startAdminView, validateAdminAuth } from "@actions/auth";
import { desc, eq, ilike, or } from "drizzle-orm";

export type AdminViewCandidate = {
	id: string;
	username: string;
	role: string;
	plan: string;
};

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
