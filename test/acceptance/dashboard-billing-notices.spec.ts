import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";

test("An ending trial opens Keep Pro from the dashboard on mobile", async ({ page, request, tourWorld }, info) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.addInitScript(() => localStorage.setItem("theme", "dark"));
	const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
	const db = tourWorld.fixture.pool;
	await db.query("UPDATE users SET plan='free' WHERE id=$1", [creatorId]);
	await db.query("UPDATE billing_subscriptions SET status='canceled' WHERE user_id=$1", [creatorId]);
	await db.query("INSERT INTO entitlement_grants(user_id,entitlement,source,starts_at,ends_at) VALUES($1,'pro_access','reverse_trial',now(),now()+interval '23 hours')", [creatorId]);
	await db.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,'new-account-pro-trial','dismissed') ON CONFLICT DO NOTHING", [creatorId]);

	await page.goto(`${tourWorld.origin}/dashboard`);
	const consent = page.getByRole("button", { name: "Reject optional", exact: true });
	await consent.click();
	const notice = page.getByRole("dialog", { name: /^Your Pro trial ends (today|tomorrow)$/ });
	await expect(notice).toBeVisible();
	await expect(notice.locator("time")).toBeVisible();
	await notice.screenshot({ path: info.outputPath("trial-notice.png"), animations: "disabled" });
	await notice.getByRole("button", { name: "Keep Pro", exact: true }).press("Enter");
	const upgrade = page.getByRole("dialog", { name: "Keep Pro", exact: true });
	await expect(upgrade).toBeVisible();
	await upgrade.getByRole("button", { name: "Close", exact: true }).press("Escape");
	await expect(upgrade).toBeHidden();
	await page.reload();
	await expect(page.getByRole("heading", { name: /^Your Pro trial ends (today|tomorrow)$/ })).toHaveCount(0);
});

test("Overdue Pro remains actionable in Billing after dismissing the desktop notice", async ({ page, request, tourWorld }, info) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.addInitScript(() => localStorage.setItem("theme", "light"));
	const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
	const db = tourWorld.fixture.pool;
	const {
		rows: [subscription],
	} = await db.query("UPDATE billing_subscriptions SET status='past_due' WHERE user_id=$1 RETURNING stripe_customer_id", [creatorId]);
	await db.query("UPDATE users SET stripe_customer_id=$2 WHERE id=$1", [creatorId, subscription.stripe_customer_id]);

	await page.goto(`${tourWorld.origin}/dashboard/settings?tab=billing`);
	const consent = page.getByRole("button", { name: "Reject optional", exact: true });
	await consent.click();
	const notice = page.getByRole("dialog", { name: "Your Pro payment is overdue" });
	await expect(notice).toBeVisible();
	await notice.screenshot({ path: info.outputPath("payment-notice.png"), animations: "disabled" });
	await notice.getByRole("button", { name: "Pay now" }).click();
	await expect(notice.getByRole("alert")).toHaveText("Could not open Stripe. Please try again.");
	await expect(notice.getByRole("button", { name: "Pay now" })).toBeEnabled();
	await notice.getByRole("button", { name: "Dismiss" }).click();
	await expect(notice).toBeHidden();
	await expect(page.getByRole("button", { name: "Pay now" })).toBeVisible();

	await db.query("UPDATE billing_subscriptions SET status='active' WHERE user_id=$1", [creatorId]);
	await page.reload();
	await expect(page.getByText("Current plan", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Pay now" })).toHaveCount(0);
});

test("Returning from cancelled Stripe checkout offers optional feedback", async ({ page, request, tourWorld }) => {
	const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
	await tourWorld.fixture.pool.query("UPDATE users SET plan='free' WHERE id=$1", [creatorId]);
	await tourWorld.fixture.pool.query("UPDATE billing_subscriptions SET status='canceled' WHERE user_id=$1", [creatorId]);
	const billing = `${tourWorld.origin}/dashboard/settings?tab=billing`;
	await page.goto(`${billing}&checkout=cancelled`);
	const consent = page.getByRole("button", { name: "Reject optional", exact: true });
	await consent.click();
	const prompt = page.getByRole("dialog", { name: "How was checkout?" });
	await expect(prompt).toBeVisible();
	await expect(prompt.getByRole("link", { name: "Send feedback" })).toHaveAttribute("href", /^mailto:contact@clipify\.us/);
	await prompt.getByRole("button", { name: "Skip" }).press("Enter");
	await expect(prompt).toBeHidden();
	await expect(page.getByText("Current plan", { exact: true })).toBeVisible();
	await page.goto(`${billing}&checkout=success`);
	await expect(page.getByText("Current plan", { exact: true })).toBeVisible();
	await expect(prompt).toHaveCount(0);
});
