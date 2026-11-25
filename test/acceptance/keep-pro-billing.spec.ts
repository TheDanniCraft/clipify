import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";

for (const [width, theme] of [
	[390, "dark"],
	[1440, "light"],
] as const) {
	test(`Trial users can keep Pro from Billing at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
		await page.setViewportSize({ width, height: 900 });
		await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
		const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
		const billingUrl = `${tourWorld.origin}/dashboard/settings?tab=billing`;
		await page.goto(billingUrl);
		await expect(page.getByText("Current plan", { exact: true })).toBeVisible();
		const keepPro = page.getByRole("button", { name: "Keep Pro", exact: true });
		await expect(keepPro).toHaveCount(0);

		const db = tourWorld.fixture.pool;
		await db.query("UPDATE users SET plan='free' WHERE id=$1", [creatorId]);
		await db.query("UPDATE billing_subscriptions SET status='canceled' WHERE user_id=$1", [creatorId]);
		await db.query("INSERT INTO entitlement_grants(user_id,entitlement,source,starts_at,ends_at) VALUES($1,'pro_access','reverse_trial',now(),now()+interval '7 days')", [creatorId]);
		await db.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,'new-account-pro-trial','dismissed') ON CONFLICT DO NOTHING", [creatorId]);
		await db.query("INSERT INTO audit_events(target_type,target_id,action,outcome,correlation_id) VALUES('creator',$1,'product:first_playback','success','billing-fixture')", [creatorId]);
		await db.query("UPDATE overlays SET theme_accent_color='#C084FC' WHERE owner_id=$1", [creatorId]);

		const attempts: string[] = [];
		await page.route("**/dashboard/settings?tab=billing", async (route) => {
			if (route.request().method() !== "POST") return route.continue();
			const body = route.request().postData() ?? "";
			if (body.includes('"product":"pro"')) {
				attempts.push(body);
				return route.abort("failed");
			}
			const response = await route.fetch();
			const original = await response.text();
			const prices = original.replace('"monthly":{"amount":null,"currency":"EUR","formatted":"Unavailable"}', '"monthly":{"amount":2,"currency":"EUR","formatted":"€2.00"}').replace('"yearly":{"amount":null,"currency":"EUR","formatted":"Unavailable"}', '"yearly":{"amount":20,"currency":"EUR","formatted":"€20.00"}');
			await route.fulfill({ response, body: prices });
		});

		await page.reload();
		const reject = page.getByRole("button", { name: "Reject optional", exact: true });
		if (await reject.isVisible()) await reject.click();
		await expect(page.getByText("Keep your custom overlay style with Pro when your trial ends.")).toBeVisible();
		await expect(page.getByRole("button", { name: "Save changes", exact: true })).toHaveCount(0);
		await keepPro.focus();
		await page.keyboard.press("Enter");
		const dialog = page.getByRole("dialog", { name: "Keep Pro", exact: true });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole("button", { name: /Upgrade to Pro for .*\/year/ })).toBeEnabled();
		await dialog.getByRole("tab", { name: "Monthly", exact: true }).click();
		const checkout = dialog.getByRole("button", { name: /Upgrade to Pro for .*\/month/ });
		await checkout.click();
		await expect(dialog.getByRole("alert")).toHaveText("Could not open checkout. Please try again.");
		expect(attempts).toHaveLength(1);
		expect(attempts[0]).toContain('"billingCycle":"monthly"');
		expect(attempts[0]).toContain('"billing_trial"');
		await expect(checkout).toBeEnabled();
		await dialog.screenshot({ path: info.outputPath("keep-pro.png"), animations: "disabled" });
		await dialog.getByRole("button", { name: "Close", exact: true }).press("Escape");
		await expect(dialog).not.toBeVisible();
		await expect(keepPro).toBeFocused();
	});
}
