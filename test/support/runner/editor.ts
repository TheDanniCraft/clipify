import { expect, type Locator, type Page } from "@playwright/test";
export async function openRunnerAppearance(page: Page) {
	const dialog = page.getByRole("dialog", { name: "Appearance", exact: true });
	if (!(await dialog.isVisible())) await page.getByRole("button", { name: "Appearance", exact: true }).click();
	await expect(dialog).toBeVisible();
	return dialog;
}
export async function openRunnerSchedule(page: Page) {
	const dialog = page.getByRole("dialog", { name: "Broadcast schedule", exact: true });
	if (!(await dialog.isVisible())) await page.getByRole("button", { name: "Schedule", exact: true }).click();
	await expect(dialog).toBeVisible();
	return dialog;
}
export async function openRunnerDestinations(page: Page) {
	const dialog = page.getByRole("dialog", { name: "Manage destinations", exact: true });
	if (!(await dialog.isVisible())) await page.getByRole("button", { name: /^(Add|Manage) destinations?$/ }).click();
	await expect(dialog).toBeVisible();
	return dialog;
}
function parts(label: string, value: string) {
	return label.endsWith("time")
		? [
				["hour", String(Number(value.slice(0, 2)))],
				["minute", value.slice(3, 5)],
			]
		: [
				["year", value.slice(0, 4)],
				["month", String(Number(value.slice(5, 7)))],
				["day", String(Number(value.slice(8, 10)))],
			];
}
export async function fillScheduleField(scope: Page | Locator, label: string, value: string) {
	if (label === "Timezone") {
		const combo = scope.getByRole("combobox", { name: label, exact: true });
		await combo.fill(value);
		const page = "page" in scope ? scope.page() : scope;
		if (value !== "Invalid/Nowhere") await page.getByRole("option", { name: value.replaceAll("_", " "), exact: true }).click();
		return;
	}
	if (!["Start date", "End date", "Displayed date", "Start time", "End time"].includes(label)) {
		await scope.getByLabel(label, { exact: true }).fill(value);
		return;
	}
	for (const [part, text] of parts(label, value)) {
		const segment = scope.getByRole("spinbutton", { name: new RegExp(`^${part}, ${label}$`, "i") });
		await segment.focus();
		await segment.pressSequentially(text);
	}
}
export async function expectScheduleField(scope: Page | Locator, label: string, value: string) {
	if (label === "Timezone") {
		await expect(scope.getByRole("combobox", { name: label, exact: true })).toHaveValue(value);
		return;
	}
	for (const [part, text] of parts(label, value)) {
		await expect(scope.getByRole("spinbutton", { name: new RegExp(`^${part}, ${label}$`, "i") })).toHaveAttribute("aria-valuenow", String(Number(text)));
	}
}
