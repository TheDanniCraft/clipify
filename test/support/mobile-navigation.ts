import { expect, type Page } from "@playwright/test";

export async function openMobileNavigation(page: Page) {
	await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
	const sidebar = page.locator('[data-slot="sidebar-mobile"]');
	await expect(sidebar).toBeVisible();
	// The native Sheet mounts offscreen before its enter scroll finishes. Clicking
	// a child then can scroll the swipe container closed. Use RAC's public state.
	await expect(sidebar.locator('xpath=ancestor::*[@data-slot="sheet-overlay"][1]')).toHaveAttribute("data-expanded", "true");
	return sidebar;
}
