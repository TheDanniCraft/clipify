/** @jest-environment node */
import { PgDialect } from "drizzle-orm/pg-core";
import { getMemberBadges, getMemberProfile, getPublicMemberProfile } from "@lib/membership";
import { memberCardIdForUser } from "@/server/memberCardId";

const execute = jest.fn();
const where = jest.fn();
const select = jest.fn(() => {
	const chain = {
		from: () => chain,
		where: (...args: unknown[]) => {
			where(...args);
			return chain;
		},
		limit: () => chain,
		innerJoin: () => chain,
		orderBy: () => chain,
		execute,
	};
	return chain;
});
jest.mock("@/db/client", () => ({ db: { select: () => select() } }));
const cardId = memberCardIdForUser("twitch-id");
const member = { id: "twitch-id", username: "clipper", avatar: "", memberNumber: null, joinedAt: new Date("2026-01-02") };

describe("member profile lookup", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		execute.mockReset();
	});
	it.each(["clipper", "12345678", "invalid-uuid"])("does not fall back to username or Twitch ID: %s", async (id) => {
		expect(await getPublicMemberProfile(id)).toBeNull();
		expect(select).not.toHaveBeenCalled();
	});
	it("selects an enabled account by card UUID and never exposes its Twitch ID", async () => {
		execute.mockResolvedValueOnce([member]).mockResolvedValueOnce([]);
		const profile = await getPublicMemberProfile(cardId);
		expect(profile).toEqual({ cardId, username: "clipper", avatar: "", memberNumber: null, joinedAt: member.joinedAt, badges: [] });
		const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
		expect(query.sql).toContain("sha256");
		expect(query.sql).toContain('"users"."id"');
		expect(query.sql).not.toContain("member_card_id");
		expect(query.sql).toContain('"users"."disabled"');
		expect(query.params.slice(-2)).toEqual([cardId, false]);
	});
	it("returns null for an unknown or disabled account", async () => {
		execute.mockResolvedValueOnce([]);
		expect(await getPublicMemberProfile(cardId)).toBeNull();
		expect(execute).toHaveBeenCalledTimes(1);
	});
	it("uses the same card UUID after a username change", async () => {
		execute.mockResolvedValueOnce([{ ...member, username: "renamed" }]).mockResolvedValueOnce([]);
		expect(await getPublicMemberProfile(cardId)).toMatchObject({ cardId, username: "renamed" });
	});
	it("keeps authenticated lookup keyed to the account ID", async () => {
		const { id: _id, ...owner } = member;
		execute.mockResolvedValueOnce([owner]).mockResolvedValueOnce([]);
		expect(await getMemberProfile("twitch-id")).toMatchObject({ cardId, avatar: "" });
		expect(new PgDialect().sqlToQuery(where.mock.calls[0][0]).params).toEqual(["twitch-id"]);
	});
	it("resolves presentation from the code registry and orders badges by priority", async () => {
		const founderDate = new Date("2026-01-02");
		const betaDate = new Date("2026-01-01");
		execute.mockResolvedValue([
			{ slug: "beta-member", awardedAt: betaDate },
			{ slug: "founder", awardedAt: founderDate },
		]);
		await expect(getMemberBadges("twitch-id")).resolves.toEqual([
			{ slug: "founder", name: "Founder", description: "One of the first 100 registered Clipify accounts.", icon: "crown", priority: 100, awardedAt: founderDate },
			{ slug: "beta-member", name: "Beta Member", description: "Helped shape Clipify during its beta.", icon: "flask", priority: 80, awardedAt: betaDate },
		]);
	});
});
