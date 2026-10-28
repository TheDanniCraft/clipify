/** @jest-environment node */
jest.mock("@/db/client", () => ({ db: { select: jest.fn() } }));
import { db } from "@/db/client";
import { PgDialect } from "drizzle-orm/pg-core";
import { isPrimaryTwitchAccount } from "@/server/primary-twitch-account";

test("only protects a Twitch identity linked to this authentication user", async () => {
	const where = jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([{ creatorId: "creator" }]) });
	jest.mocked(db.select).mockReturnValue({ from: () => ({ where }) } as never);
	expect(await isPrimaryTwitchAccount({ userId: "identity", providerId: "google", accountId: "creator" })).toBe(false);
	expect(db.select).not.toHaveBeenCalled();
	expect(await isPrimaryTwitchAccount({ userId: "identity", providerId: "twitch", accountId: "creator" })).toBe(true);
	expect(new PgDialect().sqlToQuery(where.mock.calls[0][0]).params).toEqual(["identity", "creator"]);
	where.mockReturnValue({ limit: jest.fn().mockResolvedValue([]) });
	expect(await isPrimaryTwitchAccount({ userId: "identity", providerId: "twitch", accountId: "secondary-channel" })).toBe(false);
});
