import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { createClipComposition } from "../../src/app/lib/clipComposition";
test("Reset and deletion keep other clips, templates and creators intact", async ({ page, request, tourWorld }) => {
	test.setTimeout(90000);
	const { creatorId, id } = await seedCreatorLibrary({ page, request, tourWorld }),
		composition = createClipComposition("mobile");
	const response = await request.post(`${tourWorld.origin}/api/test/auth-fixture`, { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { withProviderCredentials: true, billingState: "active" } });
	expect(response.status()).toBe(200);
	const foreign = (await response.json()).fixture.creatorId;
	const put = async (user: string, key: string, value: unknown) => tourWorld.fixture.pool.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,$2,$3)", [user, key, JSON.stringify(value)]);
	for (const user of [creatorId, foreign]) for (const key of ["camera", "other"]) await put(user, `clip-layout-template:v2:${key}`, { name: key, composition });
	await put(foreign, "clip-layout-default:v2:mobile", { id: "other" });
	const target = `clip-layout-override:v2:camera:${id}`;
	await put(creatorId, target, { composition });
	const preserved = [
		{ user: creatorId, key: "clip-layout-override:v2:camera:DifferentClip" },
		{ user: creatorId, key: `clip-layout-override:v2:other:${id}` },
		{ user: foreign, key: target },
	];
	for (const row of preserved) await put(row.user, row.key, { composition });
	await page.goto(`${tourWorld.origin}/dashboard/clip-layouts?layout=camera&clip=${id}`);
	await page.getByRole("button", { name: "Reject optional", exact: true }).click();
	await page.reload();
	await expect(page.getByRole("button", { name: "Play preview", exact: true })).toBeEnabled();
	await page.getByRole("button", { name: "Reset to template", exact: true }).click();
	await page.getByRole("button", { name: "Reset adjustments", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Reset clip adjustments", exact: true })).not.toBeVisible();
	expect((await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [creatorId, target])).rowCount).toBe(0);
	for (const row of preserved) {
		const stored = await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [row.user, row.key]);
		expect(JSON.parse(stored.rows[0].state)).toEqual({ composition });
	}
	await page.getByRole("button", { name: "Back to clip layouts", exact: true }).click();
	await page.getByRole("button", { name: "Make default", exact: true }).first().click();
	await expect(page.getByText("Default", { exact: true })).toBeVisible();
	for (const [user, expected] of [
		[creatorId, "camera"],
		[foreign, "other"],
	])
		expect(JSON.parse((await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [user, "clip-layout-default:v2:mobile"])).rows[0].state)).toEqual({ id: expected });
	await page.getByRole("button", { name: "Delete", exact: true }).first().click();
	await page.getByRole("dialog", { name: "Delete layout", exact: true }).getByRole("button", { name: "Delete layout", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Delete layout", exact: true })).not.toBeVisible();
	expect((await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [creatorId, "clip-layout-template:v2:camera"])).rowCount).toBe(0);
	expect((await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [creatorId, `clip-layout-override:v2:other:${id}`])).rowCount).toBe(1);
	expect((await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [creatorId, "clip-layout-template:v2:other"])).rowCount).toBe(1);
	expect((await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [foreign, "clip-layout-template:v2:camera"])).rowCount).toBe(1);
	expect((await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [foreign, target])).rowCount).toBe(1);
});
