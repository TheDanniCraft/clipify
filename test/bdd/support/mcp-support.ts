import { test as base } from "playwright-bdd";
import { expect as playwrightExpect } from "@playwright/test";
// OAuth journeys carry real fixture cookies and authorization codes. Keep those
// out of retained browser traces; assertions and screenshots remain available.
export const test = base.extend<{ mcpWorld: { input?: Record<string, unknown>; result?: { status: number; body: any } } }>({
	trace: "off",
	mcpWorld: async ({}, provideWorld) => {
		await provideWorld({});
	},
});
// Browser actions may use the application's existing ten-second dependency
// budget. Native deadline/benchmark assertions still compare measured values.
export const expect = playwrightExpect.configure({ timeout: 15000 });
