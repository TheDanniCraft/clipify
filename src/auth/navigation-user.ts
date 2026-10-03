import "server-only";

import { validateAuth } from "@actions/auth";
import type { DashboardNavbarUser } from "@components/dashboardNavbar";
import { getAuthSession } from "./session";

/** Resolve enough identity data to render authenticated navigation for creators and email-only agency members. */
export async function getDashboardNavbarUser(): Promise<DashboardNavbarUser | null> {
	const creator = await validateAuth();
	if (creator) return creator;

	const session = await getAuthSession();
	if (!session) return null;
	return {
		id: session.user.id,
		username: session.user.name.trim() || session.user.email,
		avatar: session.user.image ?? undefined,
	};
}
