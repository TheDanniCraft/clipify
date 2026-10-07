import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import * as schema from "@/db/auth-schema";
import { createMcpPlugins, MCP_SCOPES } from "@/auth/mcp-options";
import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	process.env.APP_ENV = "test";
	process.env.DISABLE_BACKGROUND_JOBS = "true";
	process.env.NEXT_PUBLIC_BASE_URL = "http://127.0.0.1:3107";

	process.env.BETTER_AUTH_SECRET = "isolated-mcp-provider-secret-32chars";
	const mode = process.argv[2] ?? "approve";
	const transition = mode.startsWith("resources:overlay-update:transition-") ? mode.split(":transition-")[1] : undefined;
	const transitionAgency = transition === "agency-unlink";
	let transitionObservation: unknown;
	if (transition === "trial-expiry" || transition === "grant-expiry") process.env.ENTITLEMENTS_HYBRID_ENABLED = "true";
	const commercialSource = mode.startsWith("resources:overlay-create:entitlement-") ? mode.split("entitlement-")[1] : undefined;
	let commercialObservation: { actorPersonalPlan: string; ownerEffectivePlan: string; ownerEntitlementSource: string } | undefined;
	if (commercialSource) process.env.ENTITLEMENTS_HYBRID_ENABLED = "true";
	let benchmarkTargets: Awaited<ReturnType<(typeof import("./load-benchmark"))["seedBenchmarkCreators"]>> = [];
	if (mode.includes("policy-grant") || mode.includes("policy-global-grant") || mode.includes("policy-allocation")) process.env.ENTITLEMENTS_HYBRID_ENABLED = "true";
	process.env.RATE_LIMIT_HASH_SECRET = "isolated-mcp-provider-ratelimit-32chars";
	const origin = "http://127.0.0.1:3107";
	const pauseMode = mode.includes("overlay-update:pause");
	const sourceCloses: number[] = [];
	const source = {
		role: "overlay",
		ownerId: "fixture-creator",
		sourceActive: true,
		readyState: 1,
		close(code: number) {
			sourceCloses.push(code);
		},
	};
	if (pauseMode) {
		const { addSubscriber } = await import("@/app/store/overlaySubscribers");
		addSubscriber("fixture-creator", "79e6c5a3-5368-4813-9780-49d22d99175f", source as any);
	}
	try {
		const grants = existsSync("src/server/mcp/grants.ts") ? await import("@/server/mcp/grants") : null;
		const auth = betterAuth({ baseURL: origin, secret: "isolated-mcp-provider-secret-32chars", database: drizzleAdapter(fixture.db, { provider: "pg", schema }), emailAndPassword: { enabled: true }, plugins: createMcpPlugins({ origin, options: grants?.providerGrantOptions }) });
		const signUp = await auth.api.signUpEmail({ body: { name: "MCP actor", email: "actor@example.invalid", password: "fixture-password-isolated-123" }, asResponse: true });
		const cookie = signUp.headers
			.getSetCookie()
			.map((part) => part.split(";")[0])
			.join("; ");
		const actor = await signUp.json();
		const reg = await auth.handler(new Request(`${origin}/api/auth/oauth2/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: "Controlled client", application_type: "native", redirect_uris: ["http://127.0.0.1:49999/callback"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }) }));
		const client = await reg.json();
		await fixture.pool.query(`INSERT INTO auth.organization (id,name,slug,created_at) VALUES ('creator-org','Fixture creator','fixture-creator',now()); INSERT INTO users (id,email,username,avatar,role,plan) VALUES ('fixture-creator','creator@example.invalid','Fixture creator','','user','free');`);
		await fixture.pool.query(`INSERT INTO creator_accounts (creator_id,organization_id,status) VALUES ('fixture-creator','creator-org','active')`);
		await fixture.pool.query(`INSERT INTO auth.member (id,organization_id,user_id,role,created_at) VALUES ($1,'creator-org',$2,'owner',now())`, [randomUUID(), actor.user.id]);
		if (mode === "benchmark:20") benchmarkTargets = await (await import("./load-benchmark")).seedBenchmarkCreators(fixture.pool, actor.user.id);

		if (mode.includes("policy-agency") || transitionAgency) {
			await fixture.pool.query("INSERT INTO auth.organization(id,name,slug,created_at) VALUES('policy-agency-org','Policy agency','policy-agency-org',now())");
			await fixture.pool.query("DELETE FROM auth.member WHERE user_id=$1 AND organization_id='creator-org'", [actor.user.id]);
			await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES($1,'policy-agency-org',$2,'owner',now())", [randomUUID(), actor.user.id]);
			await fixture.pool.query("INSERT INTO agency_creator_links(agency_organization_id,creator_organization_id,status,permission_ceiling,accepted_by,accepted_at) VALUES('policy-agency-org','creator-org','accepted',$1,$2,now())", [JSON.stringify(MCP_SCOPES), actor.user.id]);
		}

		if (mode.startsWith("resources:creators")) {
			await fixture.pool.query(
				`INSERT INTO auth.organization (id,name,slug,created_at) VALUES ('direct-org','Direct','direct-fixture',now()),('agency-org','Agency','agency-fixture',now()),('agency-creator-org','Agency creator','agency-creator-fixture',now()),('inaccessible-org','Private','private-fixture',now()); INSERT INTO users (id,email,username,avatar,role,plan) VALUES ('direct-creator','direct@example.invalid','Direct creator','','user','pro'),('agency-creator','agency@example.invalid','Agency creator','','user','free'),('inaccessible-creator','private@example.invalid','Private creator','','user','free'); INSERT INTO creator_accounts (creator_id,organization_id,status) VALUES ('direct-creator','direct-org','active'),('agency-creator','agency-creator-org','active'),('inaccessible-creator','inaccessible-org','active');`,
			);
			await fixture.pool.query(`INSERT INTO auth.member (id,organization_id,user_id,role,created_at) VALUES ($1,'direct-org',$2,'operations',now()),($3,'agency-org',$2,'operations',now())`, [randomUUID(), actor.user.id, randomUUID()]);
			await fixture.pool.query(`INSERT INTO agency_creator_links (agency_organization_id,creator_organization_id,status,permission_ceiling,accepted_by,accepted_at) VALUES ('agency-org','agency-creator-org','accepted','["creator:read","overlay:read","playlist:read"]',$1,now())`, [actor.user.id]);
		}
		if (
			mode === "resources:overlay-create:limit-one" ||
			commercialSource !== undefined ||
			mode.startsWith("resources:capabilities") ||
			mode.startsWith("resources:overlays") ||
			mode.startsWith("resources:overlay-get") ||
			mode.startsWith("resources:overlay-update") ||
			mode.startsWith("resources:playlists") ||
			mode.startsWith("resources:playlist-get") ||
			mode.startsWith("resources:overlay-delete") ||
			mode.startsWith("resources:playlist-update") ||
			mode.startsWith("resources:playlist-delete") ||
			mode.startsWith("resources:playlist-remove") ||
			mode.startsWith("resources:playlist-reorder") ||
			mode.startsWith("resources:playlist-add")
		) {
			if (mode.endsWith(":pro") || (mode.startsWith("resources:overlay-update") && !mode.includes(":free") && !mode.includes(":retained"))) await fixture.pool.query("UPDATE users SET plan = 'pro' WHERE id = 'fixture-creator'");
			await fixture.pool.query(`INSERT INTO overlays (id,owner_id,secret,name,status,type) VALUES ('79e6c5a3-5368-4813-9780-49d22d99175f','fixture-creator','private-overlay-secret','Existing overlay','active','Featured'); INSERT INTO playlists (id,owner_id,name) VALUES ('a1dca8b8-089a-47ce-b649-1c32bb3842c1','fixture-creator','Existing playlist')`);
		}

		const quotaBoundary = /^resources:(overlay|playlist)-create:boundary-(zero|below|exact|above)$/.exec(mode);
		if (quotaBoundary) {
			const [, kind, boundary] = quotaBoundary;
			const usage = boundary === "above" ? 2 : boundary === "exact" ? 1 : 0;
			for (let index = 0; index < usage; index++) {
				if (kind === "overlay") await fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'fixture-creator',$2,'Boundary fixture','active','Featured')", [randomUUID(), randomUUID()]);
				else await fixture.pool.query("INSERT INTO playlists(id,owner_id,name) VALUES($1,'fixture-creator','Boundary fixture')", [randomUUID()]);
			}
		}

		if (transition === "upgrade") await fixture.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
		if (transition === "trial-expiry" || transition === "grant-expiry") {
			await fixture.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
			await fixture.pool.query("INSERT INTO entitlement_grants(user_id,entitlement,source,starts_at,ends_at) VALUES('fixture-creator','pro_access',$1,now()-interval '1 day',now()+interval '1 day')", [transition === "trial-expiry" ? "reverse_trial" : "partner"]);
		}

		let retainedBefore: string | undefined;
		let retainedPlaylistBefore: string | undefined;
		if ((mode.endsWith(":retained") || mode.endsWith(":retained-run")) && (mode.startsWith("resources:overlay-get") || mode.startsWith("resources:overlay-update"))) {
			await fixture.pool.query("UPDATE overlays SET created_at=now()-interval '2 days'");
			await fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type,player_volume,theme_accent_color,created_at) VALUES('13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6','fixture-creator','private-retained-secret','Retained paid overlay','active','Featured',83,'#123456',now()-interval '1 day')");
			if (mode.endsWith(":retained-run")) await fixture.pool.query("UPDATE overlays SET status='paused' WHERE id='13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6'");
			retainedBefore = JSON.stringify((await fixture.pool.query("SELECT id,name,status,player_volume,theme_accent_color,configuration_revision FROM overlays ORDER BY id")).rows);
		}

		if ((mode.endsWith(":retained") && (mode.startsWith("resources:playlist-get") || mode.startsWith("resources:playlist-update"))) || mode.endsWith(":retained-playlist-run")) {
			await fixture.pool.query("UPDATE playlists SET created_at=now()-interval '2 days'");
			await fixture.pool.query("INSERT INTO playlists(id,owner_id,name,created_at) VALUES('13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6','fixture-creator','Retained playlist',now()-interval '1 day')");
			await fixture.pool.query("INSERT INTO playlist_clips(playlist_id,clip_id,position,clip_data) VALUES('13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6','RetainedClip',0,$1)", [JSON.stringify({ id: "RetainedClip", title: "Saved retained clip", duration: 12 })]);
			retainedPlaylistBefore = JSON.stringify((await fixture.pool.query("SELECT id,name,configuration_revision FROM playlists ORDER BY id")).rows) + JSON.stringify((await fixture.pool.query("SELECT playlist_id,clip_id,position,clip_data FROM playlist_clips ORDER BY playlist_id,position")).rows);
		}

		if (commercialSource) {
			await fixture.pool.query("INSERT INTO auth.organization(id,name,slug,created_at) VALUES('actor-personal-org','Actor personal','actor-personal-org',now()); INSERT INTO users(id,email,username,avatar,role,plan) VALUES('actor-personal','personal@example.invalid','Actor personal','','user','free'); INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES('actor-personal','actor-personal-org','active')");
			await fixture.pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES($1,'actor-personal-org',$2,'owner',now())", [randomUUID(), actor.user.id]);
			await fixture.pool.query("INSERT INTO creator_identity_links(creator_id,auth_user_id,source) VALUES('actor-personal',$1,'twitch_onboarding')", [actor.user.id]);
			if (commercialSource === "subscription") await fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
			else if (commercialSource === "trial" || commercialSource === "grant") await fixture.pool.query("INSERT INTO entitlement_grants(user_id,entitlement,source,starts_at,ends_at) VALUES('fixture-creator','pro_access',$1,now()-interval '1 day',now()+interval '1 day')", [commercialSource === "trial" ? "reverse_trial" : "partner"]);
			else if (["trial-expired", "grant-expired", "grant-future", "grant-revoked"].includes(commercialSource)) {
				await fixture.pool.query("INSERT INTO entitlement_grants(user_id,entitlement,source,starts_at,ends_at,revoked_at) VALUES('fixture-creator','pro_access',$1,$2,$3,$4)", [commercialSource.startsWith("trial") ? "reverse_trial" : "partner", new Date(Date.now() + (commercialSource === "grant-future" ? 86400000 : -172800000)), new Date(Date.now() + (commercialSource.endsWith("expired") ? -86400000 : 172800000)), commercialSource === "grant-revoked" ? new Date() : null]);
			} else if (["allocation-expired", "allocation-future", "allocation-removal-active"].includes(commercialSource)) {
				await (await import("./seed-pro-allocation")).seedCreatorProAllocation(fixture.pool, "fixture-creator", "creator-org", actor.user.id);
				if (commercialSource === "allocation-expired") await fixture.pool.query("UPDATE agency_license_allocations SET ends_at=now()-interval '1 second'");
				else if (commercialSource === "allocation-future") await fixture.pool.query("UPDATE agency_license_allocations SET effective_at=now()+interval '1 day'");
				else await fixture.pool.query("UPDATE agency_license_allocations SET status='removal_scheduled',removal_requested_at=now(),ends_at=now()+interval '1 day'");
			} else if (commercialSource === "inverse-actor") await fixture.pool.query("UPDATE users SET plan='pro' WHERE id='actor-personal'");
			else if (commercialSource === "allocation") await (await import("./seed-pro-allocation")).seedCreatorProAllocation(fixture.pool, "fixture-creator", "creator-org", actor.user.id);
			else throw new Error("Unsupported commercial fixture source");
			const { usersTable } = await import("@/db/schema");
			const { eq } = await import("drizzle-orm");
			const [owner] = await fixture.db.select().from(usersTable).where(eq(usersTable.id, "fixture-creator"));
			const entitlements = await (await import("@/app/lib/entitlements")).resolveUserEntitlements(owner, fixture.db);
			commercialObservation = { actorPersonalPlan: (await fixture.pool.query("SELECT plan FROM users WHERE id='actor-personal'")).rows[0].plan, ownerEffectivePlan: entitlements.effectivePlan, ownerEntitlementSource: entitlements.source };
		}

		if (mode === "resources:playlist-delete:audit-failure") await fixture.pool.query("CREATE FUNCTION reject_playlist_delete_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled delete audit failure'; END $$; CREATE TRIGGER reject_playlist_delete_audit BEFORE INSERT ON audit_events FOR EACH ROW WHEN (NEW.outcome='success') EXECUTE FUNCTION reject_playlist_delete_audit()");
		if (mode === "resources:overlay-get:foreign") await fixture.pool.query("INSERT INTO users (id,email,username,avatar,role,plan) VALUES ('foreign-owner','foreign@example.invalid','Foreign owner','','user','free'); INSERT INTO overlays (id,owner_id,secret,name,status,type) VALUES ('13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6','foreign-owner','private-foreign-secret','Private overlay','active','Featured')");
		if (mode.startsWith("resources:playlist-get") || mode.startsWith("resources:playlist-delete") || mode.startsWith("resources:playlist-remove") || mode.startsWith("resources:playlist-reorder") || mode.startsWith("resources:playlist-add")) {
			await fixture.pool.query("INSERT INTO playlist_clips (playlist_id,clip_id,position,clip_data) VALUES ('a1dca8b8-089a-47ce-b649-1c32bb3842c1','ClipSecond',1,$1),('a1dca8b8-089a-47ce-b649-1c32bb3842c1','ClipFirst',0,$2)", [JSON.stringify({ id: "ClipSecond", title: "Second clip", duration: 12, secret: "private-clip-secret" }), JSON.stringify({ id: "ClipFirst", title: "First clip", duration: 10, token: "private-clip-token" })]);
		}
		if (mode === "resources:playlist-add:invalid-result") await fixture.pool.query("UPDATE playlist_clips SET clip_data=$1 WHERE clip_id='ClipFirst'", [JSON.stringify({ id: "ClipFirst", title: "private-result-" + "x".repeat(1001), duration: 12 })]);
		if (mode === "resources:playlist-get:legacy-metadata") {
			await fixture.pool.query("DELETE FROM playlist_clips");
			const records = ["{broken", "null", "[]", "42", JSON.stringify({ clip: { title: "Wrapped clip", duration: 8, token: "private-metadata-token" } }), JSON.stringify({ title: 42, duration: "8" }), JSON.stringify({ clip: "invalid-wrapper", title: "Plain clip", duration: 9 })];
			for (const [position, data] of records.entries()) await fixture.pool.query("INSERT INTO playlist_clips (playlist_id,clip_id,position,clip_data) VALUES ('a1dca8b8-089a-47ce-b649-1c32bb3842c1',$1,$2,$3)", [`Legacy${position}`, position, data]);
		}
		if (retainedPlaylistBefore !== undefined) retainedPlaylistBefore = JSON.stringify((await fixture.pool.query("SELECT id,name,configuration_revision FROM playlists ORDER BY id")).rows) + JSON.stringify((await fixture.pool.query("SELECT playlist_id,clip_id,position,clip_data FROM playlist_clips ORDER BY playlist_id,position")).rows);
		if (mode.startsWith("resources:playlist-delete")) {
			await fixture.pool.query("UPDATE overlays SET playlist_id='a1dca8b8-089a-47ce-b649-1c32bb3842c1',type='Playlist' WHERE owner_id='fixture-creator'; INSERT INTO galleries (owner_id,name,published,playlist_id) VALUES ('fixture-creator','Linked gallery',true,'a1dca8b8-089a-47ce-b649-1c32bb3842c1')");
		}
		if (mode === "resources:playlist-reorder:empty-playlist") await fixture.pool.query("DELETE FROM playlist_clips");
		if (mode.startsWith("resources:playlist-add")) {
			process.env.TWITCH_CLIENT_ID = "fixture-twitch-client";
			process.env.TWITCH_CLIENT_SECRET = "fixture-twitch-secret";
			if (!mode.endsWith(":no-credentials")) {
				const { symmetricEncrypt } = await import("better-auth/crypto");
				const encrypted = await symmetricEncrypt({ key: process.env.BETTER_AUTH_SECRET!, data: "isolated-provider-token" });
				await fixture.pool.query("INSERT INTO creator_identity_links (creator_id,auth_user_id,source) VALUES ('fixture-creator',$1,'twitch_onboarding');", [actor.user.id]);
				await fixture.pool.query("INSERT INTO auth.account (id,account_id,provider_id,user_id,access_token,access_token_expires_at,scope,created_at,updated_at) VALUES ($1,'fixture-twitch-identity','twitch',$2,$3,now()+interval '1 hour','user:read:email',now(),now())", [randomUUID(), actor.user.id, encrypted]);
			}
			if (mode.endsWith(":limit") || mode.endsWith(":pro-limit")) {
				for (let i = 0; i < 48; i++) await fixture.pool.query("INSERT INTO playlist_clips (playlist_id,clip_id,position,clip_data) VALUES ('a1dca8b8-089a-47ce-b649-1c32bb3842c1',$1,$2,$3)", [`Existing${i}`, i + 2, JSON.stringify({ id: `Existing${i}`, title: "Existing clip", duration: 10 })]);
				if (mode.endsWith(":pro-limit")) await fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
			}
		}
		const verifier = "fixture-pkce-verifier-with-at-least-43-characters-12345678";
		const challenge = createHash("sha256").update(verifier).digest("base64url");
		const needsFullScopes =
			mode.startsWith("catalogue:workflow:") ||
			mode.startsWith("catalogue:quota-invariants:") ||
			mode.startsWith("catalogue:quota-races:") ||
			mode === "catalogue:revisions" ||
			mode === "catalogue:create-retries" ||
			mode === "catalogue:mutation-authority" ||
			mode === "catalogue:read-authority" ||
			mode === "catalogue:mutation-scopes" ||
			mode === "catalogue:read-scopes" ||
			mode === "catalogue:tool-results" ||
			mode === "catalogue:mutation-validation" ||
			mode === "benchmark:20" ||
			mode.startsWith("resources:capabilities") ||
			mode.startsWith("retries:") ||
			mode.startsWith("creation:") ||
			/^resources:(overlay|playlist)-(create|update|delete|add|remove|reorder)/.test(mode);
		const query = new URLSearchParams({
			client_id: client.client_id,
			redirect_uri: client.redirect_uris[0],
			response_type: "code",
			scope: needsFullScopes || mode.startsWith("selection:") ? [...MCP_SCOPES, "offline_access"].join(" ") : "creator:read overlay:read playlist:read offline_access",
			code_challenge: challenge,
			code_challenge_method: "S256",
			state: "fixture-state",
			resource: `${origin}/mcp`,
		});
		const authorization = await auth.handler(new Request(`${origin}/api/auth/oauth2/authorize?${query}`, { headers: mode === "logged-out" ? {} : { Cookie: cookie } }));
		const location = authorization.headers.get("location");
		if (!location) throw new Error(`Authorization fixture failed: ${authorization.status}`);
		if (mode === "logged-out") {
			const login = new URL(location, origin);
			console.log(JSON.stringify({ loginPath: login.pathname, signedState: login.searchParams.has("sig"), clientPreserved: login.searchParams.get("client_id") === client.client_id }));
		} else {
			const signedQuery = new URL(location, origin).search.slice(1);
			const headers = new Headers({ Cookie: cookie, Origin: origin, "Content-Type": "application/json" });
			let finalScopes = mode === "narrow" ? ["creator:read"] : ["creator:read", "overlay:read", "playlist:read", "offline_access"];
			if (mode.startsWith("selection:") && existsSync("src/server/mcp/scopes.ts")) {
				const { consentPreset } = await import("@/server/mcp/scopes");
				const selection = mode.slice(10);
				finalScopes = consentPreset(selection === "Read" ? "read" : "edit");
				if (selection.includes("overlay deletion")) finalScopes.push("overlay:delete");
				if (selection.includes("playlist deletion")) finalScopes.push("playlist:delete");
				if (selection.includes("both delete")) finalScopes.push("overlay:delete", "playlist:delete");
				if (selection.includes("deselected")) finalScopes = finalScopes.filter((scope) => !scope.endsWith(":create") && !scope.endsWith(":update"));
			}
			if (mode === "deny-empty") finalScopes = [];
			if (needsFullScopes) finalScopes = [...MCP_SCOPES, "offline_access"];
			if (mode === "catalogue:workflow:submit_feedback:read_only") finalScopes = ["creator:read"];
			if (mode.startsWith("catalogue:workflow:") && mode.endsWith(":missing_scope")) {
				const { workflowPermissions } = await import("@/server/mcp/workflows/catalogue");
				const permission = workflowPermissions[mode.split(":")[2] as keyof typeof workflowPermissions];
				finalScopes = finalScopes.filter((scope) => scope !== permission);
			}
			if (mode.startsWith("catalogue:workflow:") && mode.endsWith(":missing_secondary_scope")) {
				const secondary = { publish_gallery: "gallery:update", preview_playlist_import: "creator:read", configure_stream_session: "runner:create" };
				const permission = secondary[mode.split(":")[2] as keyof typeof secondary];
				finalScopes = finalScopes.filter((scope) => scope !== permission);
			}
			if (mode.endsWith(":no-scope")) finalScopes = finalScopes.filter((scope) => scope !== (mode.startsWith("resources:playlist-remove") || mode.startsWith("resources:playlist-reorder") || mode.startsWith("resources:playlist-add") ? "playlist-items:manage" : mode.startsWith("resources:playlist-delete") ? "playlist:delete" : "overlay:delete"));
			if (mode.endsWith(":no-read")) finalScopes = finalScopes.filter((scope) => scope !== "playlist:read");
			const selectedCreators =
				mode === "benchmark:20"
					? benchmarkTargets.map((target) => ({ creatorId: target.creatorId, agencyOrganizationId: null }))
					: mode.startsWith("resources:creators")
						? [
								{ creatorId: "fixture-creator", agencyOrganizationId: null },
								{ creatorId: "direct-creator", agencyOrganizationId: null },
								{ creatorId: "agency-creator", agencyOrganizationId: "agency-org" },
							]
						: [{ creatorId: mode === "inaccessible" ? "other" : "fixture-creator", agencyOrganizationId: mode.includes("policy-agency") || transitionAgency ? "policy-agency-org" : null }];
			if (mode === "consent:request-catalogue") {
				if (!grants?.approveMcpConsent) throw new Error("Consent catalogue requires the actual approval bridge");
				const cases = ["missing-origin", "foreign-origin", "missing-cookie", "invalid-cookie", "missing-signature", "changed-signature", "changed-client", "changed-scope"];
				const outcomes = [];
				for (const name of cases) {
					const caseHeaders = new Headers(headers);
					const caseQuery = new URLSearchParams(signedQuery);
					if (name === "missing-origin") caseHeaders.delete("Origin");
					if (name === "foreign-origin") caseHeaders.set("Origin", "https://foreign.example.invalid");
					if (name === "missing-cookie") caseHeaders.delete("Cookie");
					if (name === "invalid-cookie") caseHeaders.set("Cookie", "better-auth.session_token=invalid");
					if (name === "missing-signature") caseQuery.delete("sig");
					if (name === "changed-signature") caseQuery.set("sig", "invalid");
					if (name === "changed-client") caseQuery.set("client_id", "other-client");
					if (name === "changed-scope") caseQuery.set("scope", "creator:read overlay:delete offline_access");
					const response = await grants.approveMcpConsent({ auth, origin, headers: caseHeaders, oauthQuery: caseQuery.toString(), accept: true, scopes: finalScopes, creators: selectedCreators });
					const body = await response.json();
					const persisted = await fixture.pool.query("SELECT count(*)::int AS count FROM mcp_connection_grants");
					outcomes.push({ name, status: response.status, issuedCode: typeof body.url === "string" && new URL(body.url).searchParams.has("code"), grantCount: persisted.rows[0].count });
				}

				console.log(JSON.stringify({ outcomes }));
				return;
			}
			let consent: Response;
			if (grants?.approveMcpConsent) consent = await grants.approveMcpConsent({ auth, origin, headers, oauthQuery: mode === "csrf" ? signedQuery.replace(/sig=[^&]+/, "sig=invalid") : signedQuery, accept: !["deny", "deny-empty"].includes(mode), scopes: finalScopes, creators: selectedCreators });
			else consent = await auth.handler(new Request(`${origin}/api/auth/oauth2/consent`, { method: "POST", headers, body: JSON.stringify({ accept: !["deny", "deny-empty"].includes(mode), scope: finalScopes.join(" "), oauth_query: signedQuery }) }));
			const result = await consent.json();
			const callback = result.url ? new URL(result.url) : null;
			if (mode.startsWith("resources:") && !callback?.searchParams.get("code")) throw new Error(`Resource fixture consent failed: ${consent.status}`);
			if (!callback?.searchParams.get("code")) {
				console.log(JSON.stringify({ consentStatus: consent.status, denied: callback?.searchParams.get("error") === "access_denied", error: result.error }));
			} else {
				const body = new URLSearchParams({ grant_type: "authorization_code", client_id: client.client_id, redirect_uri: client.redirect_uris[0], code: callback.searchParams.get("code")!, code_verifier: mode === "bad-pkce" ? "wrong-verifier-that-is-long-enough-12345678901234" : verifier, resource: `${origin}/mcp` });
				if (mode === "missing-pkce") body.delete("code_verifier");
				if (mode === "changed-callback") body.set("redirect_uri", "http://127.0.0.1:49999/changed");
				if (mode === "unregistered-callback") body.set("redirect_uri", "https://unregistered.example/callback");
				if (mode === "expired-code") await fixture.pool.query("UPDATE auth.verification SET expires_at = now() - interval '1 second'");
				const exchange = () => auth.handler(new Request(`${origin}/api/auth/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }));
				const codeResponses = mode === "concurrent-code" ? await Promise.all([exchange(), exchange()]) : [await exchange()];
				const codeRaceStatuses = codeResponses.map((response) => response.status);
				const tokenResponse = codeResponses.find((response) => response.ok) ?? codeResponses[0];
				const tokens = await tokenResponse.json();
				const payload = tokens.access_token ? JSON.parse(Buffer.from(tokens.access_token.split(".")[1], "base64url").toString()) : null;

				if (mode.startsWith("catalogue:workflow:")) {
					console.log(JSON.stringify(await (await import("./workflow-catalogue")).runWorkflowCatalogue({ fixture, auth, origin, token: tokens.access_token, actorId: actor.user.id, mode })));
					return;
				}
				if (mode.startsWith("catalogue:quota-invariants:")) {
					if (!tokens.access_token) throw new Error("Quota invariant catalogue token unavailable");
					console.log(JSON.stringify(await (await import("./quota-invariant-catalogue")).runQuotaInvariantCatalogue({ fixture, auth, origin, token: tokens.access_token, cookie, actorId: actor.user.id, mode: mode.split(":").at(-1)! })));
					return;
				}

				if (mode.startsWith("catalogue:quota-races:")) {
					if (!tokens.access_token) throw new Error("Quota race catalogue token unavailable");
					console.log(JSON.stringify(await (await import("./quota-race-catalogue")).runQuotaRaceCatalogue({ fixture, auth, origin, token: tokens.access_token, cookie, mode: mode.split(":").at(-1)! })));
					return;
				}

				if (mode === "catalogue:pagination") {
					if (!tokens.access_token) throw new Error("Pagination catalogue token unavailable");
					console.log(JSON.stringify(await (await import("./pagination-catalogue")).runPaginationCatalogue({ fixture, auth, origin, token: tokens.access_token, actorId: actor.user.id, grantId: payload.clipify_grant_id })));
					return;
				}
				if (mode === "catalogue:revisions") {
					if (!tokens.access_token) throw new Error("Revision catalogue token unavailable");
					console.log(JSON.stringify(await (await import("./revision-catalogue")).runRevisionCatalogue({ fixture, auth, origin, token: tokens.access_token, cookie })));
					return;
				}
				if (mode === "catalogue:retry-isolation") {
					console.log(JSON.stringify(await (await import("./retry-isolation-catalogue")).runRetryIsolationCatalogue({ fixture, auth, origin, actorId: actor.user.id, cookie, client })));
					return;
				}
				if (mode === "catalogue:create-retries") {
					if (!tokens.access_token) throw new Error("Retry catalogue token unavailable");
					console.log(JSON.stringify(await (await import("./create-retry-catalogue")).runCreateRetryCatalogue({ fixture, auth, origin, token: tokens.access_token, actorId: actor.user.id, grantId: payload.clipify_grant_id })));
					return;
				}
				if (mode === "catalogue:read-authority") {
					if (!tokens.access_token) throw new Error("Read authority catalogue token unavailable");
					console.log(JSON.stringify(await (await import("./read-authority-catalogue")).runReadAuthorityCatalogue({ fixture, auth, origin, token: tokens.access_token, actorId: actor.user.id, grantId: payload.clipify_grant_id })));
					return;
				}
				if (mode === "catalogue:mutation-authority") {
					if (!tokens.access_token) throw new Error("Mutation authority catalogue token unavailable");
					console.log(JSON.stringify(await (await import("./mutation-authority-catalogue")).runMutationAuthorityCatalogue({ fixture, auth, origin, token: tokens.access_token, actorId: actor.user.id, grantId: payload.clipify_grant_id })));
					return;
				}
				if (mode === "catalogue:mutation-scopes" || mode === "catalogue:read-scopes") {
					if (!tokens.access_token) throw new Error("Scope catalogue token unavailable");
					console.log(JSON.stringify(await (await import("./mutation-scope-catalogue")).runMutationScopeCatalogue({ pool: fixture.pool, auth, origin, token: tokens.access_token, claims: payload, readsOnly: mode === "catalogue:read-scopes" })));
					return;
				}
				if (mode === "catalogue:tool-results") {
					if (!tokens.access_token) throw new Error("Tool result catalogue token unavailable");
					console.log(JSON.stringify(await (await import("./tool-results-catalogue")).runToolResultsCatalogue({ fixture, auth, origin, token: tokens.access_token, actorId: actor.user.id })));
					return;
				}
				if (mode === "catalogue:mutation-validation") {
					if (!tokens.access_token) throw new Error("Validation catalogue token unavailable");
					console.log(JSON.stringify(await (await import("./mutation-validation-catalogue")).runMutationValidationCatalogue({ fixture, auth, origin, token: tokens.access_token })));
					return;
				}
				if (mode === "benchmark:20") {
					if (!tokens.access_token) throw new Error("BENCHMARK_TOKEN_NOT_ISSUED");
					console.log(JSON.stringify(await (await import("./load-benchmark")).runLoadBenchmark(fixture.pool, benchmarkTargets, tokens.access_token, origin, auth)));
					return;
				}
				if (mode === "protocol:revocation-catalogue") {
					if (!tokens.access_token) throw new Error("Revocation fixture token unavailable");
					console.log(JSON.stringify(await (await import("./revocation-catalogue")).runRevocationCatalogue({ fixture, auth, origin, headers, token: tokens.access_token, claims: payload })));
					return;
				}
				if (mode === "protocol:binding-catalogue") {
					if (!tokens.access_token) throw new Error("Binding catalogue token unavailable");
					console.log(JSON.stringify(await (await import("./token-catalogue")).runTokenCatalogue(fixture.pool, auth, payload, tokens.access_token, origin, true)));
					return;
				}
				if (mode === "protocol:creator-selection-catalogue") {
					if (!tokens.access_token) throw new Error("Creator selection fixture token unavailable");
					const { runCreatorSelectionCatalogue } = await import("./creator-selection-catalogue");
					console.log(JSON.stringify(await runCreatorSelectionCatalogue({ fixture, auth, origin, token: tokens.access_token, claims: payload, headers, query, verifier, scopes: finalScopes, actorId: actor.user.id })));
					return;
				}
				if (mode === "protocol:token-catalogue") {
					const { runTokenCatalogue } = await import("./token-catalogue");
					console.log(JSON.stringify(await runTokenCatalogue(fixture.pool, auth, payload, tokens.access_token, origin)));
					return;
				}

				let connectionCount: number | undefined,
					revokeStatus: number | undefined,
					revokedAccess = false,
					revokedRefresh = false,
					secondUsable = false,
					safeConnections = false;
				if (mode === "connections") {
					const secondRegistration = await auth.handler(new Request(`${origin}/api/auth/oauth2/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: "Second client", application_type: "native", redirect_uris: ["http://127.0.0.1:49999/second"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"] }) }));
					const secondClient = await secondRegistration.json();
					const secondQuery = new URLSearchParams(query);
					secondQuery.set("client_id", secondClient.client_id);
					secondQuery.set("redirect_uri", secondClient.redirect_uris[0]);
					const secondAuthorization = await auth.handler(new Request(`${origin}/api/auth/oauth2/authorize?${secondQuery}`, { headers: { Cookie: cookie } }));
					const secondSignedQuery = new URL(secondAuthorization.headers.get("location")!, origin).search.slice(1);
					const secondConsent = await grants!.approveMcpConsent({ auth, origin, headers, oauthQuery: secondSignedQuery, accept: true, scopes: finalScopes, creators: [{ creatorId: "fixture-creator", agencyOrganizationId: null }] });
					const secondCallback = new URL((await secondConsent.json()).url);
					const secondExchange = await auth.handler(new Request(`${origin}/api/auth/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: secondClient.client_id, redirect_uri: secondClient.redirect_uris[0], code: secondCallback.searchParams.get("code")!, code_verifier: verifier, resource: `${origin}/mcp` }) }));
					const secondTokens = await secondExchange.json();
					const secondClaims = JSON.parse(Buffer.from(secondTokens.access_token.split(".")[1], "base64url").toString());
					const connections = existsSync("src/server/mcp/connections.ts") ? await import("@/server/mcp/connections") : null;
					if (connections) {
						const listed = await connections.listMcpConnections({ auth, headers });
						connectionCount = listed.length;
						safeConnections = !JSON.stringify(listed).includes(tokens.access_token) && !JSON.stringify(listed).includes(tokens.refresh_token) && listed.every((item: any) => !("clientSecret" in item));
						const revoked = await connections.revokeMcpConnection({ auth, headers, origin, grantId: payload.clipify_grant_id });
						revokeStatus = revoked.status;
						try {
							await grants!.resolveMcpGrant(payload, fixture.db);
						} catch {
							revokedAccess = true;
						}
						const refreshedRevoked = await auth.handler(new Request(`${origin}/api/auth/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", client_id: client.client_id, refresh_token: tokens.refresh_token, resource: `${origin}/mcp` }) }));
						revokedRefresh = refreshedRevoked.status >= 400;
						try {
							const secondPrincipal = await grants!.resolveMcpGrant(secondClaims, fixture.db);
							secondUsable = (await (await import("@/server/mcp/creators")).getCreatorSummary(secondPrincipal, "fixture-creator", fixture.db)).id === "fixture-creator";
						} catch {}
					}
				}
				let refreshStatus: number | undefined,
					refreshScopes: string | undefined,
					sameRefreshGrant = false,
					refreshReplayStatus: number | undefined,
					refreshRaceStatuses: number[] | undefined,
					creatorSetPreserved: boolean | undefined,
					refreshError: string | undefined,
					refreshWaiters: number | undefined;
				if (mode.startsWith("refresh:")) {
					const approvedBefore = (await fixture.pool.query("SELECT creator_id,agency_organization_id FROM mcp_grant_creators WHERE grant_id=$1 ORDER BY creator_id", [payload.clipify_grant_id])).rows;
					if (mode === "refresh:revoked-grant") await fixture.pool.query("UPDATE mcp_connection_grants SET active=false,revoked_at=now() WHERE id=$1", [payload.clipify_grant_id]);
					if (mode === "refresh:expired-grant") await fixture.pool.query("UPDATE mcp_connection_grants SET expires_at=now()-interval '1 second' WHERE id=$1", [payload.clipify_grant_id]);
					if (mode === "refresh:expired") await fixture.pool.query("UPDATE auth.oauth_refresh_token SET expires_at = now() - interval '1 second'");
					const refreshBody = new URLSearchParams({ grant_type: "refresh_token", client_id: client.client_id, refresh_token: tokens.refresh_token, resource: `${origin}/mcp` });
					if (mode === "refresh:widen") refreshBody.set("scope", "creator:read overlay:delete");
					if (mode === "refresh:wrong-client") refreshBody.set("client_id", "unregistered-client");
					if (mode === "refresh:wrong-resource") refreshBody.set("resource", "https://other.example.invalid/mcp");
					if (mode === "refresh:narrow") refreshBody.set("scope", "creator:read");
					const refresh = () => auth.handler(new Request(`${origin}/api/auth/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: refreshBody }));
					const overlap = mode === "refresh:concurrent" ? await (await import("./refresh-overlap")).runOverlappingRefresh(fixture.pool, refresh) : undefined;
					const responses = overlap ? overlap.responses : [await refresh()];
					refreshWaiters = overlap?.waiting;
					if (mode === "refresh:concurrent") refreshRaceStatuses = responses.map((response) => response.status);
					const refreshed = responses.find((response) => response.ok) ?? responses[0];
					refreshStatus = refreshed.status;
					const refreshedTokens = await refreshed.json().catch(() => null);
					refreshError = refreshedTokens?.error;
					if (mode === "refresh:reuse" || mode === "refresh:concurrent") refreshReplayStatus = (await auth.handler(new Request(`${origin}/api/auth/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: refreshBody }))).status;
					if (refreshedTokens?.access_token) {
						const refreshedClaims = JSON.parse(Buffer.from(refreshedTokens.access_token.split(".")[1], "base64url").toString());
						refreshScopes = refreshedClaims.scope;
						sameRefreshGrant = refreshedClaims.clipify_grant_id === payload.clipify_grant_id && refreshedClaims.clipify_grant_generation === payload.clipify_grant_generation && refreshedClaims.aud === payload.aud && typeof (payload.azp ?? payload.client_id) === "string" && (refreshedClaims.azp ?? refreshedClaims.client_id) === (payload.azp ?? payload.client_id) && refreshedClaims.sub === payload.sub && refreshedClaims.iss === payload.iss;
					}
					const approvedAfter = (await fixture.pool.query("SELECT creator_id,agency_organization_id FROM mcp_grant_creators WHERE grant_id=$1 ORDER BY creator_id", [payload.clipify_grant_id])).rows;
					creatorSetPreserved = JSON.stringify(approvedBefore) === JSON.stringify(approvedAfter);
				}

				let replayStatus: number | undefined;
				if (mode === "reuse-code") replayStatus = (await exchange()).status;
				const identityModes: Record<string, Record<string, unknown>> = {
					"wrong-subject": { sub: "other" },
					"wrong-client": { client_id: "other" },
					"wrong-generation": { clipify_grant_generation: 999 },
					"unknown-grant": { clipify_grant_id: randomUUID() },
					"wrong-audience": { aud: "https://example.invalid/mcp" },
				};
				if (payload && identityModes[mode]) Object.assign(payload, identityModes[mode]);
				let rejectedBinding = false;
				let principal: any;
				if (grants?.resolveMcpGrant && payload) {
					try {
						principal = await grants.resolveMcpGrant(payload, fixture.db);
					} catch {
						principal = null;
						rejectedBinding = true;
					}
				}
				let accessibleRead = false,
					unapprovedDenied = false;
				if (principal) {
					const { getCreatorSummary } = await import("@/server/mcp/creators");
					accessibleRead = (await getCreatorSummary(principal, "fixture-creator", fixture.db)).id === "fixture-creator";
					try {
						await getCreatorSummary(principal, "unapproved", fixture.db);
					} catch {
						unapprovedDenied = true;
					}
				}
				if (mode === "resources:creators:removed") await fixture.pool.query("DELETE FROM auth.member WHERE organization_id = 'direct-org'");
				const createResult = mode.startsWith("creation:") ? await (await import("./create-probe")).runCreateFixture(fixture, principal, mode) : undefined;
				const retryResult = mode.startsWith("retries:") ? await (await import("./retry-probe")).runRetryFixture(fixture, principal, mode) : undefined;
				if (mode === "resources:overlay-get:denied" || mode === "resources:overlay-update:denied" || mode === "resources:playlist-get:denied" || mode === "resources:overlay-delete:denied" || mode === "resources:playlist-update:denied" || mode === "resources:playlist-delete:denied" || mode === "resources:playlist-remove:denied" || mode === "resources:playlist-reorder:denied" || mode === "resources:playlist-add:denied")
					await fixture.pool.query("DELETE FROM auth.member WHERE organization_id='creator-org'");
				let externalClipRequests = 0;
				let resourceResult: unknown;
				const quotaBefore = mode === "resources:overlay-create:limit-one" ? JSON.stringify((await fixture.pool.query("SELECT * FROM overlays ORDER BY id")).rows) : undefined;
				let toolReplayStatus: number | undefined;
				let replayRetryAfter: string | null = null;
				let protocolErrorCode: number | undefined;
				let snapshotInterleaved: boolean | undefined;
				let policyInterleave: unknown;
				let protocolStatus: number | undefined,
					challenge: string | null = null,
					toolRead = false,
					discovery = false;
				if (mode.startsWith("protocol:") || mode.startsWith("resources:")) {
					const route = existsSync("src/app/mcp/route.ts") ? await import("@/app/mcp/route") : null;
					let token = tokens.access_token;
					if (mode === "protocol:missing-access") token = undefined;
					if (mode === "protocol:bad-signature") token = token.slice(0, -8) + "invalid!";
					if (["protocol:expired-access", "protocol:bad-issuer", "protocol:bad-audience", "protocol:missing-grant", "protocol:wrong-generation", "protocol:wrong-subject", "protocol:expiry-boundary"].includes(mode)) {
						const signed = await (auth.api as any).signJWT({
							body: {
								payload: {
									...payload,
									...(mode.endsWith("expired-access") ? { exp: 1 } : {}),
									...(mode.endsWith("missing-grant") ? { clipify_grant_id: undefined } : {}),
									...(mode.endsWith("wrong-generation") ? { clipify_grant_generation: 999 } : {}),
									...(mode.endsWith("wrong-subject") ? { sub: "other" } : {}),
									...(mode.endsWith("expiry-boundary") ? { exp: Math.floor(Date.now() / 1000) } : {}),
									...(mode.endsWith("bad-issuer") ? { iss: "https://wrong.example.invalid/api/auth" } : {}),
									...(mode.endsWith("bad-audience") ? { aud: "https://wrong.example.invalid/mcp" } : {}),
								},
								overrideOptions: { issuer: mode.endsWith("bad-issuer") ? "https://wrong.example.invalid/api/auth" : `${origin}/api/auth`, audience: mode.endsWith("bad-audience") ? "https://wrong.example.invalid/mcp" : `${origin}/mcp` },
							},
						});
						token = signed.token;
					}
					const originalFetch = globalThis.fetch;
					globalThis.fetch = (async (input: any, init: any) => {
						const request = input instanceof Request ? input : new Request(input, init);
						if (new URL(request.url).origin === origin) return auth.handler(request);
						if (mode.startsWith("resources:playlist-add") && new URL(request.url).origin === "https://api.twitch.tv" && new URL(request.url).pathname === "/helix/clips") {
							externalClipRequests++;
							if (request.headers.get("Authorization") !== "Bearer isolated-provider-token") throw new Error("Provider credential fixture did not decrypt its token");
							if (mode.endsWith(":provider-error")) return new Response("controlled provider failure", { status: 503 });
							if (mode.endsWith(":provider-timeout-headers") || mode.endsWith(":provider-timeout-body")) {
								const stall = () =>
									new Promise<never>((_resolve, reject) => {
										const watchdog = setTimeout(() => reject(new Error("Provider fixture deadline did not fire")), 12000);
										const abort = () => {
											clearTimeout(watchdog);
											reject(request.signal.reason ?? new Error("controlled provider deadline"));
										};
										if (request.signal.aborted) abort();
										else request.signal.addEventListener("abort", abort, { once: true });
									});
								if (mode.endsWith(":provider-timeout-headers")) return await stall();
								const response = new Response(null, { status: 200 });
								Object.defineProperty(response, "json", { value: stall });
								return response;
							}
							if (mode.endsWith(":revoked-during-fetch")) await fixture.pool.query("DELETE FROM auth.member WHERE organization_id='creator-org'");
							if (mode.endsWith(":revision-during-fetch")) await fixture.pool.query("UPDATE playlists SET configuration_revision=2");
							const ids = new URL(request.url).searchParams.getAll("id");
							const clips = ids.map((id) => ({
								id,
								title: `Title ${id}`,
								duration: mode.endsWith(":invalid-provider") ? -1 : 12,
								broadcaster_id: "fixture-creator",
								broadcaster_name: "Fixture creator",
								creator_id: "clip-maker",
								creator_name: "Clip maker",
								video_id: "",
								game_id: "",
								language: "en",
								view_count: 1,
								created_at: "2026-10-04T00:00:00Z",
								url: `https://clips.twitch.tv/${id}`,
								embed_url: `https://clips.twitch.tv/embed?clip=${id}`,
								thumbnail_url: `https://static-cdn.jtvnw.net/${id}.jpg`,
								vod_offset: null,
								is_featured: false,
								secret: "private-provider-secret",
							}));
							return Response.json({ data: mode.endsWith(":not-found") ? [] : clips });
						}
						throw new Error("External fetch is forbidden in the fixture");
					}) as typeof fetch;
					try {
						const message =
							mode === "protocol:modern"
								? { jsonrpc: "2.0", id: 1, method: "server/discover", params: { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {} } } }
								: {
										jsonrpc: "2.0",
										id: 1,
										method: "tools/call",
										params: {
											name: mode.startsWith("resources:playlist-add")
												? "add_playlist_items"
												: mode.startsWith("resources:playlist-reorder")
													? "reorder_playlist_items"
													: mode.startsWith("resources:playlist-remove")
														? "remove_playlist_items"
														: mode.startsWith("resources:playlist-delete")
															? "delete_playlist"
															: mode.startsWith("resources:playlist-update")
																? "update_playlist"
																: mode.startsWith("resources:playlist-create")
																	? "create_playlist"
																	: mode.startsWith("resources:overlay-delete")
																		? "delete_overlay"
																		: mode.startsWith("resources:playlist-get")
																			? "get_playlist"
																			: mode.startsWith("resources:playlists")
																				? "list_playlists"
																				: mode.startsWith("resources:overlay-update")
																					? "update_overlay"
																					: mode.startsWith("resources:overlay-create")
																						? "create_overlay"
																						: mode.startsWith("resources:overlay-get")
																							? "get_overlay"
																							: mode.startsWith("resources:overlays")
																								? "list_overlays"
																								: mode.startsWith("resources:capabilities")
																									? "get_capabilities"
																									: "list_creators",
											arguments: mode.startsWith("resources:playlist-add")
												? { creatorId: "fixture-creator", playlistId: mode.endsWith(":missing") || mode.endsWith(":retained") ? "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6" : "a1dca8b8-089a-47ce-b649-1c32bb3842c1", expectedRevision: mode.endsWith(":stale") ? 2 : 1, clipIds: ["NewFirst", "NewSecond"] }
												: mode.startsWith("resources:playlist-reorder")
													? {
															creatorId: "fixture-creator",
															playlistId: mode.endsWith(":missing") || mode.endsWith(":retained") ? "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6" : "a1dca8b8-089a-47ce-b649-1c32bb3842c1",
															expectedRevision: mode.endsWith(":stale") ? 2 : 1,
															itemIds: mode.endsWith(":omit") ? ["ClipSecond"] : mode.endsWith(":extra") ? ["ClipSecond", "ClipFirst", "UnknownClip"] : mode.endsWith(":duplicate") ? ["ClipFirst", "ClipFirst"] : mode.endsWith(":empty") || mode.endsWith(":empty-playlist") ? [] : ["ClipSecond", "ClipFirst"],
														}
													: mode.startsWith("resources:playlist-remove")
														? { creatorId: "fixture-creator", playlistId: mode.endsWith(":missing") || mode.endsWith(":retained") ? "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6" : "a1dca8b8-089a-47ce-b649-1c32bb3842c1", expectedRevision: mode.endsWith(":stale") ? 2 : 1, itemIds: mode.endsWith(":unknown-item") ? ["UnknownClip"] : mode.endsWith(":mixed-items") ? ["ClipFirst", "UnknownClip"] : ["ClipFirst"] }
														: mode.startsWith("resources:playlist-delete")
															? { creatorId: "fixture-creator", playlistId: mode.endsWith(":missing") || mode.endsWith(":retained") ? "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6" : "a1dca8b8-089a-47ce-b649-1c32bb3842c1", expectedRevision: mode.endsWith(":stale") ? 2 : 1 }
															: mode.startsWith("resources:playlist-update")
																? { creatorId: "fixture-creator", playlistId: mode.endsWith(":missing") || mode.endsWith(":retained") ? "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6" : "a1dca8b8-089a-47ce-b649-1c32bb3842c1", expectedRevision: mode.endsWith(":stale") ? 2 : 1, name: "Renamed playlist" }
																: mode.startsWith("resources:playlist-create")
																	? { creatorId: "fixture-creator", retryKey: "public-playlist-key", name: "Agent playlist" }
																	: mode.startsWith("resources:overlay-delete")
																		? { creatorId: "fixture-creator", overlayId: mode.endsWith(":missing") || mode.endsWith(":retained") || mode.endsWith(":retained-run") ? "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6" : "79e6c5a3-5368-4813-9780-49d22d99175f", expectedRevision: mode.endsWith(":stale") ? 2 : 1 }
																		: mode.startsWith("resources:playlist-get")
																			? { creatorId: "fixture-creator", playlistId: mode.endsWith(":missing") || mode.endsWith(":retained") ? "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6" : "a1dca8b8-089a-47ce-b649-1c32bb3842c1" }
																			: mode.startsWith("resources:playlists")
																				? { creatorId: "fixture-creator", limit: 25 }
																				: mode.startsWith("resources:overlay-update")
																					? {
																							creatorId: "fixture-creator",
																							overlayId: mode.endsWith(":missing") || mode.endsWith(":retained") || mode.endsWith(":retained-run") ? "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6" : "79e6c5a3-5368-4813-9780-49d22d99175f",
																							expectedRevision: mode.endsWith(":stale") ? 2 : 1,
																							patch: mode.endsWith(":retained-run") ? { status: "active" } : mode.endsWith(":retained-playlist-run") ? { type: "Playlist", playlistId: "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6" } : pauseMode ? { status: "paused" } : mode.endsWith(":free-basic") ? { name: "Free name edit" } : mode.endsWith(":free-filter") ? { minClipViews: 100 } : mode.endsWith(":free-styling") ? { themeAccentColor: "#123456" } : { name: "Edited by agent", playerVolume: 70 },
																						}
																					: mode.startsWith("resources:overlay-create")
																						? { creatorId: "fixture-creator", retryKey: "public-create-key", name: "Agent overlay" }
																						: mode.startsWith("resources:overlay-get")
																							? { creatorId: "fixture-creator", overlayId: ["resources:overlay-get:foreign", "resources:overlay-get:missing", "resources:overlay-get:retained"].includes(mode) ? "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6" : "79e6c5a3-5368-4813-9780-49d22d99175f" }
																							: mode.startsWith("resources:overlays")
																								? { creatorId: mode.endsWith(":bad-id") ? "../other" : "fixture-creator", limit: mode.endsWith(":bad-limit") ? 101 : 25, ...(mode.endsWith(":unknown") ? { secret: "private-input-value" } : {}) }
																								: mode.startsWith("resources:capabilities")
																									? { creatorId: "fixture-creator" }
																									: {},
										},
									};
						if (mode.startsWith("protocol:unknown-tool:") && "name" in message.params) message.params.name = mode.slice("protocol:unknown-tool:".length);
						if (mode.includes(":unknown:audit-storage-failure") && "arguments" in message.params) (message.params.arguments as Record<string, unknown>).secret = "private-input-value";
						const request = new Request(`${origin}/mcp`, {
							method: "POST",
							headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...(mode === "protocol:modern" ? { "MCP-Method": "server/discover" } : {}), "MCP-Protocol-Version": mode === "protocol:modern" ? "2026-07-28" : "2025-06-18", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(mode === "protocol:origin" ? { Origin: "https://evil.example.invalid" } : {}) },
							body: JSON.stringify(message),
						});
						if (transition) {
							const { observeConnectedTransition } = await import("./connected-transition");
							transitionObservation = await observeConnectedTransition({ route: route!, origin, headers: request.headers, transition, actorId: actor.user.id, pool: fixture.pool });
						}

						let snapshotWriter;
						let policyWriter;
						if (mode.includes("overlay-update:policy-")) {
							const { interleaveOwnerPolicyWriter } = await import("./policy-writer-interleave");
							if (mode.includes("policy-custom-role")) {
								await fixture.pool.query("INSERT INTO auth.organization_role(id,organization_id,role,permission) VALUES('runtime-editor-role','creator-org','runtime-editor',$1)", [JSON.stringify({ creator: ["read"], overlay: ["update"] })]);
								await fixture.pool.query("UPDATE auth.member SET role='runtime-editor' WHERE user_id=$1 AND organization_id='creator-org'", [actor.user.id]);
							}
							if (mode.includes("policy-grant") || mode.includes("policy-global-grant")) {
								await fixture.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
								await fixture.pool.query("INSERT INTO entitlement_grants(user_id,entitlement,starts_at,ends_at) VALUES($1,'pro_access',now()-interval '1 day',now()+interval '1 day')", [mode.includes("policy-global-grant") ? null : "fixture-creator"]);
							}
							if (mode.includes("policy-allocation")) {
								const { seedCreatorProAllocation } = await import("./seed-pro-allocation");
								await seedCreatorProAllocation(fixture.pool, "fixture-creator", "creator-org", actor.user.id);
							}
							policyWriter = interleaveOwnerPolicyWriter(fixture.pool, "fixture-creator", mode.split(":policy-")[1] as Parameters<typeof interleaveOwnerPolicyWriter>[2], actor.user.id);
						}
						if (mode === "resources:playlist-get:snapshot") {
							const { interleavePlaylistWriter } = await import("./playlist-snapshot-interleave");
							snapshotWriter = interleavePlaylistWriter(fixture.pool);
						}
						if (mode.endsWith(":audit-storage-failure")) {
							await fixture.pool.query("CREATE FUNCTION reject_read_audit_storage() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled private audit storage failure'; END $$; CREATE TRIGGER reject_read_audit_storage BEFORE INSERT ON audit_events FOR EACH ROW WHEN (NEW.action LIKE 'sensitive-integration:mcp.%') EXECUTE FUNCTION reject_read_audit_storage()");
							if (mode.includes(":denied:")) await fixture.pool.query("DELETE FROM auth.member WHERE organization_id='creator-org'");
						}
						const result = route ? await route.POST(request) : new Response(null, { status: 503 });

						protocolStatus = result.status;
						challenge = result.headers.get("www-authenticate");
						let responseText: string;
						try {
							responseText = await result.text();
						} finally {
							if (policyWriter) {
								policyWriter.restore();
								policyInterleave = await policyWriter.finish();
							}
							if (snapshotWriter) {
								snapshotInterleaved = snapshotWriter.committed();
								snapshotWriter.restore();
							}
						}
						const data =
							responseText.startsWith("event:") || responseText.startsWith("data:")
								? responseText
										.split("\n")
										.find((line) => line.startsWith("data:"))
										?.slice(5)
										.trim()
								: responseText;
						const value = data ? JSON.parse(data) : null;
						protocolErrorCode = value?.error?.code;
						resourceResult = value?.result?.structuredContent;
						if (mode.startsWith("resources:overlay-create") || mode.startsWith("resources:playlist-create")) {
							// Prior calls fill the fixed actor budget before the replay request.
							if (mode.endsWith(":rate-limit")) await fixture.pool.query("UPDATE rate_limit_counters SET count=120 WHERE action='mcp:call:actor-client'");
							const repeat = await route!.POST(new Request(`${origin}/mcp`, { method: "POST", headers: request.headers, body: JSON.stringify({ ...message, id: 2 }) }));
							toolReplayStatus = repeat.status;
							replayRetryAfter = repeat.headers.get("retry-after");
							const text = await repeat.text();
							const line =
								text.startsWith("event:") || text.startsWith("data:")
									? text
											.split("\n")
											.find((line) => line.startsWith("data:"))
											?.slice(5)
											.trim()
									: text;
							const replay = line ? JSON.parse(line) : null;
							resourceResult = { created: resourceResult, replayed: replay?.result?.structuredContent };
						}

						toolRead = value?.result?.structuredContent?.items?.[0]?.id === "fixture-creator";
						discovery = Boolean(value?.result?._meta?.["io.modelcontextprotocol/serverInfo"]?.name === "Clipify" && value?.result?.supportedVersions?.includes("2026-07-28") && value?.result?.capabilities?.tools);
					} finally {
						globalThis.fetch = originalFetch;
					}
				}
				const deletionState = mode.startsWith("resources:playlist-delete")
					? { playlists: Number((await fixture.pool.query("SELECT count(*) FROM playlists")).rows[0].count), items: Number((await fixture.pool.query("SELECT count(*) FROM playlist_clips")).rows[0].count), overlay: (await fixture.pool.query("SELECT playlist_id,configuration_revision FROM overlays WHERE owner_id='fixture-creator'")).rows[0], gallery: (await fixture.pool.query("SELECT playlist_id,published FROM galleries WHERE owner_id='fixture-creator'")).rows[0] }
					: undefined;
				const persistedItems = mode.startsWith("resources:playlist-remove") || mode.startsWith("resources:playlist-reorder") || mode.startsWith("resources:playlist-add") ? (await fixture.pool.query("SELECT clip_id,position FROM playlist_clips ORDER BY position,clip_id")).rows : undefined;
				const persistedPlaylist = mode.startsWith("resources:playlist-update") || mode.startsWith("resources:playlist-remove") || mode.startsWith("resources:playlist-reorder") || mode.startsWith("resources:playlist-add") ? (await fixture.pool.query("SELECT name,configuration_revision FROM playlists WHERE owner_id='fixture-creator'")).rows[0] : undefined;
				const persistedOverlay = mode.startsWith("resources:overlay-update") ? (await fixture.pool.query("SELECT name, configuration_revision, player_volume FROM overlays WHERE owner_id='fixture-creator'")).rows[0] : undefined;
				const playlistCount = mode.startsWith("resources:playlist-create") ? Number((await fixture.pool.query("SELECT count(*) FROM playlists")).rows[0].count) : undefined;
				const quotaStateChanged = quotaBefore === undefined ? undefined : quotaBefore !== JSON.stringify((await fixture.pool.query("SELECT * FROM overlays ORDER BY id")).rows);

				let retainedRuntimeObservation: Record<string, unknown> | undefined;
				if (mode.endsWith(":retained-run") || mode.endsWith(":retained-playlist-run")) {
					const { getOverlayRuntimeAccessInternal } = await import("@/server/overlays");
					const target = await getOverlayRuntimeAccessInternal(mode.endsWith(":retained-run") ? "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6" : "79e6c5a3-5368-4813-9780-49d22d99175f", "http");
					const primary = await getOverlayRuntimeAccessInternal("79e6c5a3-5368-4813-9780-49d22d99175f", "http");
					retainedRuntimeObservation = { allowed: target.allowed, reason: target.allowed ? null : target.reason, primaryAllowed: primary.allowed, effectivePlaylistId: target.allowed ? target.overlay.playlistId : null };
					if (mode.endsWith(":retained-playlist-run")) {
						const { getPlaylistRuntimeClipsForOwnerServer } = await import("@/app/actions/database");
						retainedRuntimeObservation.retainedClipCount = (await getPlaylistRuntimeClipsForOwnerServer("fixture-creator", "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6")).length;
						retainedRuntimeObservation.storedPlaylistId = (await fixture.pool.query("SELECT playlist_id FROM overlays WHERE id='79e6c5a3-5368-4813-9780-49d22d99175f'")).rows[0].playlist_id;
					}
				}

				const retainedPlaylistStateUnchanged = retainedPlaylistBefore === undefined ? undefined : retainedPlaylistBefore === JSON.stringify((await fixture.pool.query("SELECT id,name,configuration_revision FROM playlists ORDER BY id")).rows) + JSON.stringify((await fixture.pool.query("SELECT playlist_id,clip_id,position,clip_data FROM playlist_clips ORDER BY playlist_id,position")).rows);
				const retainedStateUnchanged = retainedBefore === undefined ? undefined : retainedBefore === JSON.stringify((await fixture.pool.query("SELECT id,name,status,player_volume,theme_accent_color,configuration_revision FROM overlays ORDER BY id")).rows);
				const resourceCount = mode.startsWith("resources:overlays") || mode.startsWith("resources:overlay-create") || mode.startsWith("resources:overlay-delete") ? Number((await fixture.pool.query("SELECT count(*) FROM overlays")).rows[0].count) : undefined;
				console.log(
					JSON.stringify({
						retainedStateUnchanged,
						retainedRuntimeObservation,
						retainedPlaylistStateUnchanged,
						commercialObservation,
						deletionState,
						sourceCloses,
						sourceActive: source.sourceActive,
						activityRecords: (await fixture.pool.query("SELECT actor_user_id,actor_session_id,target_type,target_id,action,outcome,reason,metadata FROM audit_events WHERE action LIKE 'sensitive-integration:mcp.%' ORDER BY occurred_at,id")).rows,
						externalClipRequests,
						persistedItems,
						persistedPlaylist,
						persistedOverlay,
						createResult,
						retryResult,
						playlistCount,
						resourceCount,
						quotaStateChanged,
						resourceResult,
						transitionObservation,
						toolReplayStatus,
						replayRetryAfter,
						codeRaceStatuses,
						connectionCount,
						revokeStatus,
						revokedAccess,
						revokedRefresh,
						secondUsable,
						safeConnections,
						refreshReplayStatus,
						refreshRaceStatuses,
						refreshWaiters,
						refreshError,
						creatorSetPreserved,
						refreshStatus,
						refreshScopes,
						sameRefreshGrant,
						protocolStatus,
						protocolErrorCode,
						snapshotInterleaved,
						policyInterleave,
						challenge,
						toolRead,
						discovery,
						rejectedBinding,
						accessibleRead,
						unapprovedDenied,
						consentStatus: consent.status,
						tokenStatus: tokenResponse.status,
						audience: payload?.aud,
						issuer: payload?.iss,
						hasGrant: typeof payload?.clipify_grant_id === "string",
						generation: payload?.clipify_grant_generation,
						scopes: payload?.scope,
						approvedCreators: principal?.creators?.map((c: any) => c.creatorId),
						replayStatus,
						error: tokens.error,
					}),
				);
			}
		}
	} finally {
		if (existsSync("src/server/mcp/grants.ts")) {
			const { dbPool } = await import("@/db/client");
			await dbPool.end();
		}
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
