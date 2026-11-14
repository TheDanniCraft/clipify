import { expect, type Page } from "@playwright/test";
export async function openEventSection(page: Page, name: string) {
	const tab = page.getByRole("tab", { name, exact: true });
	if (await tab.isVisible()) {
		await tab.click();
		return;
	}
	const mobile = page.viewportSize()!.width <= 768;
	if (mobile) {
		const toggle = page.getByRole("button", { name: "Toggle navigation", exact: true });
		await expect(toggle).toBeEnabled();
		if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
	}
	const container = mobile ? page.locator('[data-slot="sidebar-mobile"]') : page.locator('[data-slot="sidebar"]');
	const item = container.getByRole("row", { name, exact: true });
	await expect(item).toBeVisible();
	await item.click();
	await expect(page.getByRole("tabpanel", { name, exact: true })).toBeVisible();
}
