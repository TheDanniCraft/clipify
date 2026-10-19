import { openRunnerDestinations } from "../../support/runner/editor";
import { createBdd } from "playwright-bdd";
import { Pool } from "pg";
import { test, expect } from "../support/mcp-support";
import { browserDatabaseUrl } from "../../support/mcp/browser-database.cjs";

const { When, Then } = createBdd(test);
When("they cancel and then confirm deleting that saved destination", async ({ page, mcpWorld }) => {
	const name = mcpWorld.input?.destinationName as string;
	await openRunnerDestinations(page);
	const remove = page.getByRole("button", { name: `Delete ${name}`, exact: true });
	await expect(remove).toBeVisible();
	await remove.click();
	const dialog = page.getByRole("dialog", { name: "Delete destination?", exact: true });
	await expect(dialog).toBeVisible();
	await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(page.getByRole("button", { name: `Edit ${name}`, exact: true })).toBeVisible();
	await remove.click();
	await dialog.getByRole("button", { name: "Delete destination", exact: true }).click();
	await expect(dialog).toHaveCount(0);
});
Then("the destination is removed from the browser and storage", async ({ page, mcpWorld }) => {
	await page.reload();
	await expect(page.getByText(mcpWorld.input?.destinationName as string, { exact: true })).toHaveCount(0);
	const state = mcpWorld.input?.runnerManual as { owner: { fixture: { creatorId: string } }; runnerId: string };
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		const result = await pool.query("SELECT count(*) FROM runner_destinations WHERE owner_id=$1", [state.owner.fixture.creatorId]);
		expect(Number(result.rows[0].count)).toBe(0);
	} finally {
		await pool.end();
	}
});
When("they enter a custom destination with a name containing {int} characters", async ({ page, mcpWorld }, length: number) => {
	mcpWorld.input = { ...mcpWorld.input, destinationName: "x".repeat(length) };
	const manager = await openRunnerDestinations(page);
	const add = manager.getByRole("button", { name: "Add destination", exact: true });
	await expect(add).toBeVisible();
	await add.click();
	const editor = page.getByRole("dialog", { name: "Add destination", exact: true });
	await editor.getByLabel("Destination name", { exact: true }).fill("x".repeat(length));
	await editor.getByRole("button", { name: /Provider$/ }).click();
	await page.getByRole("option", { name: "Custom RTMP", exact: true }).click();
	await editor.getByLabel("RTMP URL", { exact: true }).fill("rtmp://127.0.0.1:1940/local");
	const save = editor.getByRole("button", { name: "Save destination", exact: true });
	if (await save.isEnabled()) await save.click();
});
Then("the destination name is {string} and saved data agrees", async ({ page, mcpWorld }, outcome: string) => {
	const name = mcpWorld.input?.destinationName as string;
	const state = mcpWorld.input?.runnerManual as { owner: { fixture: { creatorId: string } }; runnerId: string };
	if (outcome === "accepted") {
		await expect(page.getByRole("dialog", { name: "Add destination", exact: true })).toHaveCount(0);
		await page.reload();
		await openRunnerDestinations(page);
		await expect(page.getByRole("button", { name: `Edit ${name}`, exact: true })).toBeVisible();
	} else {
		await expect(page.getByText(/1.*80 characters/)).toBeVisible();
	}
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		const rows = await pool.query("SELECT name FROM runner_destinations WHERE owner_id=$1", [state.owner.fixture.creatorId]);
		expect(rows.rows).toEqual(outcome === "accepted" ? [{ name }] : []);
	} finally {
		await pool.end();
	}
});

When("they reopen a legacy broadcast and save its configuration twice", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.runnerManual as { owner: { fixture: { creatorId: string } }; runnerId: string };
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	let sessionId: string;
	try {
		const sessions = await pool.query("SELECT id FROM stream_sessions WHERE owner_id=$1 AND runner_id=$2", [state.owner.fixture.creatorId, state.runnerId]);
		expect(sessions.rows).toHaveLength(1);
		sessionId = sessions.rows[0].id;
		// Reconstruct the persisted pre-conversion shape in this disposable fixture only.
		await pool.query("DELETE FROM stream_session_destinations WHERE session_id=$1", [sessionId]);
		await pool.query("DELETE FROM runner_destinations WHERE owner_id=$1", [state.owner.fixture.creatorId]);
	} finally {
		await pool.end();
	}
	await page.reload();
	for (let save = 0; save < 2; save++) {
		if (save === 0) {
			const manager = await openRunnerDestinations(page);
			await manager.getByRole("button", { name: "Add destination", exact: true }).click();
			const editor = page.getByRole("dialog", { name: "Add destination", exact: true });
			await editor.getByLabel("Destination name", { exact: true }).fill("Twitch");
			await editor.getByLabel("Destination stream key", { exact: true }).fill("replacement-fixture-key");
			await editor.getByRole("button", { name: "Save destination", exact: true }).click();
			await expect(editor).not.toBeVisible();
			await page.keyboard.press("Escape");
		} else await expect(page.getByRole("group", { name: "Broadcast destinations" }).getByRole("button", { name: /Broadcast destinations$/ })).toContainText("Twitch");
		await Promise.all([page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `/dashboard/runners/${state.runnerId}` && Boolean(response.request().postData()?.includes(sessionId))), page.getByRole("button", { name: "Save Configuration", exact: true }).click()]);
		await page.reload();
	}
});
Then("its converted destination remains visible once after reloading", async ({ page, mcpWorld }) => {
	await openRunnerDestinations(page);
	await expect(page.getByRole("button", { name: "Edit Twitch", exact: true })).toHaveCount(1);
	const state = mcpWorld.input?.runnerManual as { owner: { fixture: { creatorId: string } }; runnerId: string };
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		const targets = await pool.query("SELECT id,credential_revision FROM runner_destinations WHERE owner_id=$1", [state.owner.fixture.creatorId]);
		expect(targets.rows).toHaveLength(1);
		expect(targets.rows[0].credential_revision).toBe(1);
		const references = await pool.query("SELECT destination_id FROM stream_session_destinations WHERE owner_id=$1", [state.owner.fixture.creatorId]);
		expect(references.rows).toEqual([{ destination_id: targets.rows[0].id }]);
	} finally {
		await pool.end();
	}
});
