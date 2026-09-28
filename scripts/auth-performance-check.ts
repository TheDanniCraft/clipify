import { performance } from "node:perf_hooks";
import { PGlite } from "@electric-sql/pglite";
import { authorize } from "../src/auth/authorize";
import { classifyDashboardSession } from "../src/auth/session-boundary";
import { acceptInvitation, createInvitation, type InvitationState } from "../src/auth/invitations";
import { onboardTwitchIdentity, type CreatorOnboardingState } from "../src/auth/creator-onboarding";

type Metric = { name: string; iterations: number; p50Ms: number; p95Ms: number; maxMs: number; thresholdMs: number };

function percentile(samples: readonly number[], quantile: number) {
	const sorted = [...samples].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1))] ?? 0;
}

async function measure(name: string, iterations: number, thresholdMs: number, operation: (iteration: number) => unknown | Promise<unknown>): Promise<Metric> {
	for (let iteration = 0; iteration < Math.min(25, iterations); iteration += 1) await operation(iteration);
	const samples: number[] = [];
	for (let iteration = 0; iteration < iterations; iteration += 1) {
		const startedAt = performance.now();
		await operation(iteration);
		samples.push(performance.now() - startedAt);
	}
	return { name, iterations, p50Ms: percentile(samples, 0.5), p95Ms: percentile(samples, 0.95), maxMs: Math.max(...samples), thresholdMs };
}

function emptyOnboardingState(): CreatorOnboardingState {
	return { users: [], providerAccounts: [], creators: [], organizations: [], memberships: [], identityLinks: [] };
}

async function main() {
	const now = new Date("2026-09-28T00:00:00.000Z");
	const database = new PGlite();
	await database.exec("CREATE TABLE auth_session (id text PRIMARY KEY, user_id text NOT NULL, expires_at timestamptz NOT NULL); CREATE TABLE creator_identity (auth_user_id text PRIMARY KEY, creator_id text NOT NULL, organization_id text NOT NULL, status text NOT NULL);");
	await database.query("INSERT INTO auth_session VALUES ($1, $2, $3), ('expired', $2, $4)", ["session", "auth-user", new Date(now.getTime() + 60_000), new Date(now.getTime() - 1)]);
	await database.query("INSERT INTO creator_identity VALUES ($1, 'creator', 'creator-org', 'active')", ["auth-user"]);
	const metrics: Metric[] = [];
	metrics.push(
		await measure("local-authorization", 2_000, 100, () =>
			authorize({
				session: { userId: "auth-user", authenticatedAt: now },
				creatorId: "creator",
				lifecycle: "active",
				resourceOwnerId: "creator",
				permission: "overlay:update",
				access: { kind: "direct", permissions: ["overlay:update"] },
				entitlements: ["pro"],
				now,
			}),
		),
	);
	metrics.push(
		await measure("database-session-resolution", 500, 200, async () => {
			const result = await database.query<{ id: string; user_id: string; expires_at: Date; creator_id: string; organization_id: string; status: string }>("SELECT session.id, session.user_id, session.expires_at, identity.creator_id, identity.organization_id, identity.status FROM auth_session session JOIN creator_identity identity ON identity.auth_user_id = session.user_id WHERE session.id = $1", ["session"]);
			const row = result.rows[0];
			if (!row) throw new Error("PERFORMANCE_FIXTURE_SESSION_MISSING");
			const session = classifyDashboardSession({ betterAuthSession: { id: row.id, userId: row.user_id, expiresAt: row.expires_at }, now });
			if (!session.authenticated) throw new Error("PERFORMANCE_FIXTURE_SESSION_REJECTED");
			if (row.status !== "active") throw new Error("PERFORMANCE_FIXTURE_DOMAIN_MISSING");
			return row;
		}),
	);
	metrics.push(
		await measure("twitch-onboarding-journey", 100, 180_000, async (iteration) => {
			const state = emptyOnboardingState();
			let id = 0;
			return onboardTwitchIdentity(
				{ subject: `twitch-${iteration}`, username: "creator", email: `creator-${iteration}@example.invalid`, emailVerified: true },
				{
					transaction: async (operation) => operation(state),
				},
				() => `id-${iteration}-${(id += 1)}`,
			);
		}),
	);
	metrics.push(
		await measure("invitation-acceptance-journey", 100, 180_000, async (iteration) => {
			const state: InvitationState = { invitations: [], memberships: [] };
			const dependencies = {
				repository: { transaction: async <T>(operation: (draft: InvitationState) => Promise<T>) => operation(state) },
				now: () => now,
				generateToken: () => `token-${iteration}`,
				roleExists: async () => true,
				deliver: async () => undefined,
			};
			const invitation = await createInvitation({ organizationId: "creator-org", email: "member@example.invalid", role: "operations", inviterId: "owner", delivery: "copy" }, dependencies);
			return acceptInvitation({ token: invitation.token, authenticatedEmail: "member@example.invalid", authUserId: `member-${iteration}` }, dependencies);
		}),
	);
	await database.close();

	const failed = metrics.filter((metric) => metric.p95Ms > metric.thresholdMs);
	console.log(JSON.stringify({ runtime: { bun: process.versions.bun ?? "unknown", platform: process.platform, arch: process.arch }, metrics, result: failed.length ? "fail" : "pass" }, null, 2));
	if (failed.length) throw new Error(`AUTH_PERFORMANCE_THRESHOLD_EXCEEDED:${failed.map((metric) => metric.name).join(",")}`);
}

await main();
