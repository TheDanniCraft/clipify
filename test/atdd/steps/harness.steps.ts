import { createBdd } from "playwright-bdd";
import { expect, test } from "../support/auth-engine-rewrite";

const { Given, Then } = createBdd(test);

Given("the auth rewrite acceptance harness is initialized", async ({ authWorld }) => {
	expect(authWorld.clock.now().toISOString()).toBe("2026-09-27T12:00:00.000Z");
});

Then("its controlled token sequence starts from a known value", async ({ authWorld }) => {
	expect(authWorld.nextToken()).toBe("atdd-000001");
});
