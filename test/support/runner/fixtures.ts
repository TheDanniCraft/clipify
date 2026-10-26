import { generateKeyPairSync } from "node:crypto";
import { FixtureBuilder } from "../auth-engine-rewrite/database";

export const RUNNER_FIXTURE_NOW = new Date("2026-10-14T12:00:00.000Z");
export const runnerOwnerFixture = new FixtureBuilder({ id: "runner-owner", organizationId: "runner-owner-org", plan: "free", effectivePro: false, activeLegacyRunnerGrant: false, activeAgencyRunnerAllocation: false });
export const runnerAccessFixtures = {
	free: runnerOwnerFixture,
	pro: runnerOwnerFixture.with({ plan: "pro", effectivePro: true }),
	trial: runnerOwnerFixture.with({ effectivePro: true }),
	legacy: runnerOwnerFixture.with({ activeLegacyRunnerGrant: true }),
	agency: runnerOwnerFixture.with({ activeAgencyRunnerAllocation: true }),
};
export const runnerOperatorFixture = new FixtureBuilder({ id: "runner-operator", ownerId: "runner-owner", permissions: ["runner:create", "runner:update", "runner:delete"] });
export function ephemeralRunnerKeys() {
	return generateKeyPairSync("ed25519");
}
