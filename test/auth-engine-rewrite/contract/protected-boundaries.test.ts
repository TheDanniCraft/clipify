import { readFileSync } from "node:fs";
import path from "node:path";
import { appendAuditEvent, type AuditEvent } from "@/auth/audit";
import { authorize } from "@/auth/authorize";

const gallerySource = readFileSync(path.join(process.cwd(), "src/app/actions/gallery.ts"), "utf8");

describe("TDD-US3-004 protected server boundaries", () => {
	it("routes the migrated gallery read and mutation batch through the central evaluator", () => {
		expect(gallerySource).toContain('from "@/auth/authorize"');
		for (const permission of ["gallery:create", "gallery:read", "gallery:update", "gallery:delete", "gallery:publish"]) expect(gallerySource).toContain(`"${permission}"`);
		expect(gallerySource).toContain("authorize({");
	});

	it("keeps authorization on the server and out of client state", () => {
		expect(gallerySource).toMatch(/^"use server";/);
		expect(gallerySource).not.toMatch(/authClient\.organization\.hasPermission|localStorage|sessionStorage/);
	});

	it.each([
		["AUTHENTICATION_REQUIRED", { session: null }],
		["ACCOUNT_SUSPENDED", { lifecycle: "suspended" }],
		["RESOURCE_OWNERSHIP_MISMATCH", { resourceOwnerId: "someone-else" }],
		["ACCESS_PATH_REQUIRED", { access: { kind: "none", permissions: [] } }],
		["PERMISSION_DENIED", { access: { kind: "direct", permissions: [] } }],
		["OWNER_REQUIRED", { access: { kind: "direct", permissions: ["gallery:delete"] }, ownerOnlyAction: "account:delete" }],
		["ENTITLEMENT_REQUIRED", { requiredEntitlement: "pro", entitlements: [] }],
	] as const)("denies %s without invoking a mutation", (code, override) => {
		let mutations = 0;
		const decision = authorize({
			session: { userId: "member", authenticatedAt: new Date("2026-09-28T00:00:00.000Z") },
			creatorId: "creator",
			lifecycle: "active",
			resourceOwnerId: "creator",
			permission: "gallery:delete",
			access: { kind: "direct", permissions: ["gallery:delete"] },
			entitlements: ["pro"],
			now: new Date("2026-09-28T00:00:00.000Z"),
			...override,
		} as Parameters<typeof authorize>[0]);
		if (decision.allowed) mutations += 1;
		expect(decision).toMatchObject({ allowed: false, code });
		expect(mutations).toBe(0);
	});

	it.each(["success", "denied", "error"] as const)("records a redacted sensitive-integration %s outcome", (outcome) => {
		const events: AuditEvent[] = [];
		appendAuditEvent(events, {
			actionClass: "sensitive-integration",
			action: "integration:reauthorize",
			outcome,
			correlationId: `integration:${outcome}`,
			metadata: { accessToken: "secret", provider: "twitch" },
			occurredAt: new Date("2026-09-28T00:00:00.000Z"),
		});
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({ actionClass: "sensitive-integration", outcome, metadata: { accessToken: "[REDACTED]", provider: "twitch" } });
	});
});
