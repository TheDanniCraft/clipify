"use server";

import { validateAuth } from "@actions/auth";
import { getMemberProfile } from "@lib/membership";

export async function getOwnMemberProfile() {
	const user = await validateAuth();
	if (!user) return null;
	return getMemberProfile(user.id);
}
