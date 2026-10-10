import { renderAccountDeletedEmail, renderAccountLifecycleEmail } from "@/server/notifications/templates/account-lifecycle";
import { renderAgencyAllocationEmail } from "@/server/notifications/templates/agency-allocation";
import { renderAccountAccessEmail } from "@/server/notifications/templates/account-access";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderBrandedEmail, EmailNotice, EMAIL_BRAND_ACCENT } from "@/server/notifications/templates/layout";
import { renderIdentitySecurityEmail, type IdentitySecurityTemplateInput } from "@/server/notifications/templates/identity-security";

const inputs: IdentitySecurityTemplateInput[] = [
	{ type: "welcome", name: "Creator" },
	{ type: "invitation", organizationName: "Creator Team", invitationUrl: "https://clipify.us/accept-invitation?id=example" },
	{ type: "security", message: "A security setting changed." },
	{ type: "account-data-export", downloadUrl: "https://clipify.us/api/account/export?token=example", expiresAt: new Date("2030-01-01T00:00:00Z") },
	{ type: "agency-access", agencyName: "Agency", creatorName: "Creator", status: "granted" },
];
for (const input of inputs) {
	test(`${input.type} has the shared brand, readable HTML and complete text alternative`, async () => {
		const mail = await renderIdentitySecurityEmail(input);
		assert.match(mail.html, /<!DOCTYPE/);
		assert.match(mail.html, /https?:\/\/[^\"]+\/web-app-manifest-192x192\.png/);
		assert.match(mail.html, /alt="Clipify logo"/);
		assert.ok(mail.html.includes(EMAIL_BRAND_ACCENT));
		assert.match(mail.html, /max-width:600px/);
		assert.match(mail.html, /https:\/\/help.clipify.us\//);
		assert.match(mail.text, /Clipify/);
		assert.match(mail.html, /You are receiving this email because/);
		assert.match(mail.text, /You are receiving this email because/);
		assert.doesNotMatch(mail.text, /not a newsletter/);
		assert.doesNotMatch(mail.text, /<table|<img|<script/);
		if (input.type === "invitation") assert.ok(mail.text.includes(input.invitationUrl));
		if (input.type === "account-data-export") {
			assert.ok(mail.text.includes(input.downloadUrl));
			assert.match(mail.text, /January 1, 2030/);
			assert.ok(mail.text.includes("Do not share it"));
		}
	});
}

test("OTP and HTML-sensitive content remain escaped and complete in plain text", async () => {
	const mail = await renderBrandedEmail({ subject: "Verify\r\nClipify", paragraphs: ['<script>alert("example")</script>'], code: "123456" });
	assert.equal(mail.subject, "Verify Clipify");
	assert.doesNotMatch(mail.html, /<script>/);
	assert.match(mail.html, /&lt;script&gt;/);
	assert.match(mail.text, /123456/);
	assert.match(mail.text, /<script>alert\("example"\)<\/script>/);
});

test("action buttons reject executable URL schemes", async () => {
	await assert.rejects(renderBrandedEmail({ subject: "Example", paragraphs: [], action: { label: "Open", url: "javascript:alert(1)" } }), /INVALID_EMAIL_ACTION_URL/);
});

test("separate title, theme metadata and JSX notices survive native rendering", async () => {
	const mail = await renderBrandedEmail({ subject: "Inbox subject", title: "Visible title", children: createElement(EmailNotice, { type: "error" }, "Please try again.") });
	assert.equal(mail.subject, "Inbox subject");
	assert.match(mail.html, /Visible title/);
	assert.match(mail.html, /prefers-color-scheme: dark/);
	assert.match(mail.html, /name="color-scheme" content="light dark"/);
	assert.match(mail.html, /clipify.us<\/a>/);
	assert.match(mail.text, /Error/);
	assert.match(mail.text, /Please try again/);
});

for (const state of [{ disabled: true, automatic: true }, { disabled: true, reason: "Policy violation" }, { disabled: false }]) {
	test(`account access ${JSON.stringify(state)} has complete text and exactly one notice icon`, async () => {
		const mail = await renderAccountAccessEmail({ name: "Alex", ...state });
		assert.match(mail.text, /Hi Alex/);
		assert.match(mail.html, /email-notice/);
		assert.equal((mail.html.match(/aria-hidden="true"/g) || []).length, 1);
		if (state.automatic) {
			assert.equal(mail.subject, "Your Twitch connection has expired");
			assert.match(mail.text, /haven't used Clipify for a while/);
			assert.match(mail.text, /Twitch account settings/);
			assert.match(mail.text, /sign in again with Twitch/);
			assert.match(mail.text, /Reconnect Twitch/);
		}
		if (state.reason) assert.match(mail.text, /Policy violation/);
	});
}

test("security notices state each specific change and offer support", async () => {
	for (const change of ["passkey-added", "passkey-removed", "email-changed"] as const) {
		const mail = await renderIdentitySecurityEmail({ type: "security", change });
		assert.match(mail.text, /Contact support/);
		assert.match(mail.text, change === "email-changed" ? /email address.*changed/ : change === "passkey-added" ? /passkey was added/ : /passkey was removed/);
	}
});

test("lifecycle notices have readable dates, recovery actions and accurate cancellation copy", async () => {
	for (const boundary of ["request", "suspension", "7d", "3d", "1d", "0d", "recovery"] as const) {
		const mail = await renderAccountLifecycleEmail(boundary, { effectiveAt: new Date("2030-01-01T12:00:00Z"), recoveryPath: "/dashboard/settings/account/recovery" });
		assert.doesNotMatch(mail.text, /2030-01-01T/);
		if (boundary === "recovery") assert.match(mail.subject, /deletion has been canceled/);
		else {
			assert.match(mail.text, /January 1, 2030/);
			assert.match(mail.text, /Restore account/);
			assert.match(mail.html, /dashboard\/settings\/account\/recovery/);
		}
		if (boundary === "0d") assert.match(mail.subject, /deleted today/);
	}
});

test("agency Pro end notices preserve data reassurance and link to plans", async () => {
	for (const boundary of ["granted", "removal-scheduled", "removal-30d", "removal-7d", "removal-3d", "removal-1d", "ended"] as const) {
		const mail = await renderAgencyAllocationEmail(boundary, { agencyName: "Creator Agency", effectiveAt: new Date("2030-01-01T12:00:00Z") });
		assert.doesNotMatch(mail.text, /2030-01-01T/);
		if (boundary === "granted") {
			assert.match(mail.text, /Open your dashboard/);
			assert.doesNotMatch(mail.text, /View Pro plans/);
		} else {
			assert.match(mail.text, /January 1, 2030/);
			assert.match(mail.text, /View Pro plans/);
			assert.match(mail.html, /\/pricing/);
		}
	}
});

test("final deletion confirmation is accurate about retention and offers no restore link", async () => {
	const mail = await renderAccountDeletedEmail();
	assert.match(mail.subject, /has been deleted/);
	assert.match(mail.text, /won't receive any more emails/);
	assert.doesNotMatch(mail.text, /retention periods/);
	assert.doesNotMatch(mail.text, /Restore account/);
});

test("benefit variants use the shared brand and distinguish gifts, trials, runner access and cancellation", async () => {
	const { renderBenefitEmail } = await import("@/server/notifications/templates/benefits");
	for (const benefit of ["pro", "runner"] as const)
		for (const event of ["granted", "trial-30d", "trial-7d", "access-30d", "access-7d", "access-3d", "access-1d", "trial-3d", "trial-1d", "ended", "revoked", "updated", "restored", "cancellation", "cancellation-30d", "cancellation-7d", "cancellation-3d", "cancellation-1d", "cancellation-0d"] as const) {
			const mail = await renderBenefitEmail({ type: "benefit", benefit, event, trial: event.startsWith("trial"), startsAt: "2030-01-01T12:00:00Z", endsAt: "2030-01-08T12:00:00Z", reason: "Thanks for reporting a bug" });
			assert.match(mail.html, /Clipify logo/);
			assert.match(mail.html, /@media/);
			if (event !== "revoked" && event !== "cancellation-0d") assert.match(mail.text, /January 8, 2030/);
			if (benefit === "runner") assert.doesNotMatch(mail.subject, /Pro/);
			if (event === "granted") {
				assert.match(mail.subject, /7 days/);
				assert.match(mail.text, /Thanks for reporting a bug/);
			}
			if (event === "cancellation") {
				assert.match(mail.text, /sorry to see you go/);
				assert.match(mail.text, /feedback/);
				assert.match(mail.text, /help.clipify.us/);
			}
		}
	const { renderAgencyAllocationEmail } = await import("@/server/notifications/templates/agency-allocation");
	for (const boundary of ["granted", "removal-scheduled", "removal-30d", "removal-7d", "removal-3d", "removal-1d", "ended"] as const) {
		const mail = await renderAgencyAllocationEmail(boundary, { agencyName: "Creator Agency", product: "runner", effectiveAt: new Date("2030-01-08T12:00:00Z") });
		assert.match(mail.subject, /runner/);
		assert.doesNotMatch(mail.text, /Pro/);
	}
});

test("support references in welcome, deletion and badge emails are clickable and survive plain-text rendering", async () => {
	const { renderBadgeEmail } = await import("@/server/notifications/templates/badge");
	const messages = [await renderIdentitySecurityEmail({ type: "welcome", name: "Alex" }), await renderAccountLifecycleEmail("request", { effectiveAt: new Date("2030-01-01T12:00:00Z"), recoveryPath: "/dashboard/settings/account/recovery" }), await renderAccountDeletedEmail(), await renderBadgeEmail({ name: "Contributor", description: "Community contribution", event: "removed" })];
	for (const mail of messages) {
		assert.match(mail.html, /<a\b[^>]*href="mailto:contact@clipify\.us"[^>]*>contact@clipify\.us<\/a>/);
		const textOutsideLinks = mail.html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/g, "").replace(/<[^>]*>/g, "");
		assert.doesNotMatch(textOutsideLinks, /https?:\/\/|contact@clipify\.us/);
		assert.match(mail.text, /https:\/\/help\.clipify\.us\//);
		assert.doesNotMatch(mail.text, /\[object Object\]/);
	}
});

test("contact support buttons open email while the Help Center links to guides", async () => {
	const mail = await renderIdentitySecurityEmail({ type: "security", change: "passkey-added" });
	assert.match(mail.html, /<a\b[^>]*href="mailto:contact@clipify\.us"[^>]*>[\s\S]*?Contact support/);
	assert.match(mail.html, /<a\b[^>]*href="https:\/\/help\.clipify\.us\/"[^>]*>Help Center<\/a>/);
	assert.match(mail.text, /contact@clipify\.us/);
	assert.match(mail.text, /If the button doesn't work, send an email to:/);
	assert.doesNotMatch(mail.html, />mailto:contact@clipify\.us</);
});

test("Pro thank-you emails are personal, with distinct first-time and renewal wording", async () => {
	const { renderProMembershipEmail } = await import("@/server/notifications/templates/pro-membership");
	for (const event of ["first-pro", "renewal", "welcome-back"] as const) {
		const mail = await renderProMembershipEmail({ type: "pro-membership", event, name: "Alex" });
		assert.match(mail.text, /Hi Alex/);
		assert.match(mail.text, /trust/);
		assert.match(mail.text, /content creation/);
		assert.match(mail.text, /reply to this email/);
		assert.match(mail.text, /Daniel/);
		if (event === "renewal") assert.match(mail.text, /has renewed/);
		if (event === "welcome-back") assert.match(mail.text, /subscription is active again/);
	}
	const existing = await renderProMembershipEmail({ type: "pro-membership", event: "first-pro", name: "Alex", existing: true });
	assert.match(existing.text, /been supporting/);
	assert.doesNotMatch(existing.text, /just upgraded/);
});
test("trial start explains the seven-day gift and reminders use the real Pro feature catalog", async () => {
	const { renderBenefitEmail } = await import("@/server/notifications/templates/benefits");
	const input = { type: "benefit" as const, benefit: "pro" as const, trial: true, startsAt: "2030-01-01T12:00:00Z", endsAt: "2030-01-08T12:00:00Z" };
	const start = await renderBenefitEmail({ ...input, event: "granted" });
	assert.match(start.subject, /7 days/);
	assert.match(start.text, /explore Clipify/);
	const reminder = await renderBenefitEmail({ ...input, event: "trial-3d" });
	assert.match(reminder.text, /3 days/);
	assert.match(reminder.text, /Theme Studio/);
	assert.match(reminder.html, /<ul\b/);
	assert.match(reminder.html, /<li\b/);
	assert.match(reminder.text, /saved configuration and content are retained/);
	assert.doesNotMatch(reminder.text, /Runner access/);
});
test("Partner end separates badge removal from the seven-day Pro transition", async () => {
	const { renderPartnerEmail } = await import("@/server/notifications/templates/partner");
	for (const days of [30, 7, 3, 1] as const) {
		const mail = await renderPartnerEmail({ event: `partner-ending-${days}d`, endsAt: "2030-01-08T12:00:00Z" });
		assert.match(mail.subject, new RegExp(`ends in ${days} day`));
		assert.match(mail.text, /seven more days/);
		assert.match(mail.text, /Contact us/);
	}
	const scheduled = await renderPartnerEmail({ event: "partner-scheduled", endsAt: "2030-01-08T12:00:00Z" });
	assert.match(scheduled.text, /January 8, 2030/);
	assert.match(scheduled.text, /January 15, 2030/);
	assert.match(scheduled.text, /seven additional days/);
	const ended = await renderPartnerEmail({ event: "ended", endsAt: "2030-01-08T12:00:00Z", proContinues: true });
	assert.match(ended.text, /still have Pro/);
	assert.doesNotMatch(ended.text, /account is now on Free/);
	const noEnd = await renderPartnerEmail({ event: "updated", endsAt: null });
	assert.match(noEnd.text, /Your partnership with Clipify will continue/);
	assert.doesNotMatch(noEnd.text, /scheduled end date/);
});

test("ended Pro features render as a semantic unordered list with a readable plain-text alternative", async () => {
	const { renderProMembershipEmail } = await import("@/server/notifications/templates/pro-membership");
	const mail = await renderProMembershipEmail({ type: "pro-membership", event: "payment-ended", name: "Alex" });
	assert.match(mail.html, /<ul\b/);
	assert.equal((mail.html.match(/<li\b/g) || []).length, 6);
	assert.match(mail.text, /You no longer have access to the following features:/);
	assert.match(mail.text, /Theme Studio/);
});
