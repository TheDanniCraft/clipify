/** @jest-environment node */
import { createMcpPostgresFixture } from "../support/mcp/postgres";
import { readCommunityCreatorStats } from "@/server/community-preview";
import type { QueryClient } from "@/db/client";

jest.setTimeout(60000);
test("counts only available public clips for the exact discoverable creator and rechecks privacy", async () => {
	const fixture = await createMcpPostgresFixture();
	try {
		await fixture.pool.query("INSERT INTO users(id,email,username,avatar,role,plan) VALUES ('preview_owner','test@example.test','preview_owner','','user','free')");
		await fixture.pool.query("INSERT INTO \"userSettings\"(id,creator_page_enabled,creator_page_visibility) VALUES('preview_owner',true,'discoverable')");
		const now = new Date();
		const clip = { id: "one", created_at: now.toISOString() };
		for (const [key, value, expiry] of [
			["clip:preview_owner:one", clip, null],
			["clip:preview_owner:two", { clip: { ...clip, id: "two" } }, null],
			["clip:preview_owner:expired", clip, new Date(now.getTime() - 1000)],
			["clip:preview_owner:removed", { clip, unavailable: true }, null],
			["clip:preview_owner:invalid", { id: "incomplete" }, null],
			["clip:previewXowner:other", clip, null],
			["clip:preview_owner_other:other", clip, null],
		] as const)
			await fixture.pool.query("INSERT INTO \"twitchCache\"(type,key,value,expires_at) VALUES('clip',$1,$2,$3)", [key, JSON.stringify(value), expiry]);
		expect(await readCommunityCreatorStats(fixture.db, "preview_owner", now)).toEqual({ status: "ready", clipCount: 2 });
		await fixture.pool.query('DELETE FROM "twitchCache"');
		expect(await readCommunityCreatorStats(fixture.db, "preview_owner", now)).toEqual({ status: "ready", clipCount: 0 });
		await fixture.pool.query("UPDATE \"userSettings\" SET creator_page_visibility='unlisted'");
		expect(await readCommunityCreatorStats(fixture.db, "preview_owner", now)).toEqual({ status: "unavailable" });
		await fixture.pool.query("UPDATE \"userSettings\" SET creator_page_visibility='discoverable',creator_page_enabled=false");
		expect(await readCommunityCreatorStats(fixture.db, "preview_owner", now)).toEqual({ status: "unavailable" });
		await fixture.pool.query('UPDATE "userSettings" SET creator_page_enabled=true,creator_page_visibility=NULL,show_in_community=true');
		expect(await readCommunityCreatorStats(fixture.db, "preview_owner", now)).toEqual({ status: "ready", clipCount: 0 });
		await fixture.pool.query("UPDATE users SET disabled=true");
		expect(await readCommunityCreatorStats(fixture.db, "preview_owner", now)).toEqual({ status: "unavailable" });
	} finally {
		await fixture.close();
	}
});

test("does not expose a false zero after failure or query invalid identifiers", async () => {
	const execute = jest.fn().mockRejectedValue(new Error("Database unavailable"));
	const client = { execute } as unknown as QueryClient;
	await expect(readCommunityCreatorStats(client, "preview_owner")).resolves.toEqual({ status: "unavailable" });
	execute.mockClear();
	for (const invalid of ["", "a".repeat(129), "%", "owner:clip", 123] as const) await expect(readCommunityCreatorStats(client, invalid as string)).resolves.toEqual({ status: "unavailable" });
	expect(execute).not.toHaveBeenCalled();
});
