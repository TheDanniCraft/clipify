import { test as base } from "playwright-bdd";
import { ControlledClock, DeterministicMailAdapter, createDeterministicTokenGenerator } from "../../support/auth-engine-rewrite";

interface AuthWorldFixtures {
	authWorld: {
		clock: ControlledClock;
		mail: DeterministicMailAdapter;
		nextToken: () => string;
		values: Map<string, unknown>;
	};
}

export const test = base.extend<AuthWorldFixtures>({
	authWorld: async ({}, provide) => {
		await provide({
			clock: new ControlledClock(),
			mail: new DeterministicMailAdapter(),
			nextToken: createDeterministicTokenGenerator("bdd"),
			values: new Map(),
		});
	},
});

export { expect } from "@playwright/test";
