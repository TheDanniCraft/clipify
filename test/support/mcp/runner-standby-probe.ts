import type { runRunnerFreeProProbe } from "./runner-free-pro-probe";

type Actions = typeof import("@/app/actions/runner");
/** Existing authenticated appearance entry, using real session/permission checks. */
export async function runRunnerStandbyPermissionProbe(input: Parameters<typeof runRunnerFreeProProbe>[0] & { runnerId: string; actions: Actions; headers: Headers }) {
	const { auth } = await import("@/auth/config");
	const initialized = await input.actions.saveRunnerBrandingProfile({ ownerId: "fixture-creator", runnerId: input.runnerId, expectedRevision: 0, watermarkCorner: "bottom_right", proShowAttribution: false });
	const before = (await input.fixture.pool.query("SELECT * FROM runner_branding_profiles WHERE owner_id='fixture-creator' AND runner_id=$1", [input.runnerId])).rows;
	await input.fixture.pool.query("DELETE FROM auth.member WHERE organization_id='creator-org' AND user_id=$1", [input.actorId]);
	const session = await auth.api.getSession({ headers: input.headers });
	const denied = await input.actions.saveRunnerBrandingProfile({ ownerId: "fixture-creator", runnerId: input.runnerId, expectedRevision: 1, watermarkCorner: "top_left", proShowAttribution: true });
	const after = (await input.fixture.pool.query("SELECT * FROM runner_branding_profiles WHERE owner_id='fixture-creator' AND runner_id=$1", [input.runnerId])).rows;
	const membershipRemaining = Number((await input.fixture.pool.query("SELECT count(*) FROM auth.member WHERE organization_id='creator-org' AND user_id=$1", [input.actorId])).rows[0].count);
	return { authenticated: session?.user.id === input.actorId, initialized: initialized.success, action: "saveRunnerBrandingProfile", denied, unchanged: JSON.stringify(before) === JSON.stringify(after), membershipRemaining, profileCount: after.length };
}
