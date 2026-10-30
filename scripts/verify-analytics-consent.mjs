import assert from "node:assert/strict";
import { mock } from "bun:test";
import { resolvePolicyRules } from "@c15t/core";
import { consentPolicyRules } from "../src/app/lib/consent/policy";

let browsers = ["one"];
let fail = false;
const decisions = new Map();
mock.module("server-only", () => ({}));
mock.module("../src/app/lib/consent/backend", () => ({
	getConsentServerKey: () => "test-only-key",
	getC15t: () => {
		throw new Error("Unexpected HTTP transport in unit fixture");
	},
}));
mock.module("@c15t/node-sdk", () => ({
	createC15tClient: () => ({
		subjects: {
			list: async (input) => {
				assert.equal(input.externalId, "verified-account");
				if (fail) throw new Error("offline");
				return { ok: true, data: { subjects: browsers.map((id) => ({ id })) } };
			},
			identify: async (id, input) => {
				assert.equal(input.externalId, "verified-account");
				if (!browsers.includes(id)) browsers.push(id);
				return { ok: true };
			},
			get: async (id) => ({ ok: true, data: { subjectChoice: decisions.get(id) ?? null } }),
		},
	}),
}));
const { readAnalyticsConsent, linkRequestAnalyticsSubject } = await import("../src/server/analytics-consent");
const resolution = resolvePolicyRules({ rules: consentPolicyRules, countryCode: "DE", regionCode: null });
assert.equal(resolution.status, "matched");
if (resolution.status !== "matched") throw new Error("Fixture policy did not resolve");
const fingerprint = resolution.fingerprints.choice;
function choice(value, confirmedAt = Date.now(), basis = fingerprint) {
	return { version: 3, categories: { measurement: { value, confirmedAt, basis: { kind: "choice-v1", fingerprint: basis } } } };
}
decisions.set("one", choice(true));
assert.equal(await readAnalyticsConsent("verified-account"), true, "current grant");
decisions.set("one", choice(false));
assert.equal(await readAnalyticsConsent("verified-account"), false, "rejection");
decisions.set("one", choice(true, Date.now() - 181 * 86400000));
assert.equal(await readAnalyticsConsent("verified-account"), false, "expired grant");
decisions.set("one", choice(true, Date.now(), "older-purpose"));
assert.equal(await readAnalyticsConsent("verified-account"), false, "outdated purpose");
browsers = ["one", "two"];
decisions.set("one", choice(true, Date.now() - 10000));
decisions.set("two", choice(false));
assert.equal(await readAnalyticsConsent("verified-account"), false, "newer rejection on another linked browser");
browsers = [];
const requestState = { initialRecords: { subject: { subjectId: "new-browser" }, choice: choice(true) } };
assert.equal(await readAnalyticsConsent("verified-account", requestState), false, "a request cookie alone cannot authorize account tracking");
decisions.set("new-browser", choice(true));
assert.equal(await linkRequestAnalyticsSubject("verified-account", requestState), true);
assert.equal(await readAnalyticsConsent("verified-account", requestState), true, "first signup links native server consent before collection");
decisions.set("new-browser", choice(false));
assert.equal(await readAnalyticsConsent("verified-account", requestState), false, "forged or stale cookie grants cannot override server rejection");
browsers = ["one", "two"];
decisions.set("one", choice(true, Date.now() - 10000));
decisions.set("two", choice(false));
assert.equal(await readAnalyticsConsent("verified-account", requestState), false, "request state cannot override newer linked rejection");
const tiedAt = Date.now();
browsers = ["one", "two"];
decisions.set("one", choice(false, tiedAt));
decisions.set("two", choice(true, tiedAt));
assert.equal(await readAnalyticsConsent("verified-account"), false, "rejection wins tied confirmation times");
fail = true;
assert.equal(await readAnalyticsConsent("verified-account"), false, "unavailable authority");
console.log("Native analytics consent boundaries verified");
