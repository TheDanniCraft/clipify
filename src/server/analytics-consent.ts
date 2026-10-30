import "server-only";
import { createC15tClient } from "@c15t/node-sdk";
import { createConsentKernel, resolvePolicyRules, type ExplicitChoice } from "@c15t/core";
import { getC15t, getConsentServerKey } from "@/app/lib/consent/backend";
import { resolveRequestConsent, type RequestConsentState } from "@c15t/core/server";
import { headers } from "next/headers";
import { consentPolicyRules } from "@/app/lib/consent/policy";

/** Native c15t resolves verified subjects and evaluates current purpose/expiry; no second consent ledger. */
export async function readAnalyticsConsent(authUserId: string, requestState?: RequestConsentState) {
	if (typeof authUserId !== "string" || !authUserId) return false;
	const apiKey = getConsentServerKey();
	if (!apiKey) return false;
	try {
		const client = createC15tClient({ baseUrl: "https://clipify.us/api/c15t", apiKey, fetch: (input, init) => getC15t().handler(new Request(input, init)) });
		const subjects = await client.subjects.list({ externalId: authUserId });
		if (!subjects.ok) return false;
		const details = await Promise.all(subjects.data.subjects.map((subject) => client.subjects.get(subject.id)));
		let latest: ExplicitChoice["categories"]["measurement"];
		for (const detail of details) {
			if (!detail.ok) return false;
			const decision = detail.data.subjectChoice?.categories.measurement;
			if (decision && (!latest || decision.confirmedAt > latest.confirmedAt || (decision.confirmedAt === latest.confirmedAt && !decision.value))) latest = decision;
		}
		const kernel = createConsentKernel({
			...requestState,
			initialPolicyResolution: resolvePolicyRules({ rules: consentPolicyRules, countryCode: "DE", regionCode: null }),
			initialRecords: { choice: latest ? { version: 3, categories: { measurement: latest } } : null },
		});
		const allowed = kernel.getSnapshot().effectivePermissions.measurement === true;
		kernel.dispose();
		return allowed;
	} catch {
		return false;
	}
}

/** Read the native request record before Next finishes the response, including first signup. */
export async function readRequestAnalyticsState() {
	try {
		return await resolveRequestConsent({ adapter: "clipify", request: { headers: await headers() }, mode: "offline", offline: { policyRules: consentPolicyRules } });
	} catch {
		return undefined;
	}
}

/** Only a verified account operation may link its own current browser subject. */
export async function linkRequestAnalyticsSubject(authUserId: string, requestState?: RequestConsentState) {
	const subjectId = requestState?.initialRecords?.subject?.subjectId;
	if (!subjectId) return true;
	const apiKey = getConsentServerKey();
	if (!apiKey || !authUserId) return false;
	try {
		const client = createC15tClient({ baseUrl: "https://clipify.us/api/c15t", apiKey, fetch: (input, init) => getC15t().handler(new Request(input, init)) });
		return (await client.subjects.identify(subjectId, { externalId: authUserId })).ok;
	} catch {
		return false;
	}
}
