export type IdentitySecurityTemplateInput = { type: "welcome"; name: string } | { type: "invitation"; organizationName: string; invitationUrl: string } | { type: "security"; message: string } | { type: "agency-access"; agencyName: string; creatorName: string; status: "granted" | "removed" };

export interface RenderedTransactionalEmail {
	subject: string;
	text: string;
	html: string;
	templateVersion: "identity-security-v1";
}

export function renderIdentitySecurityEmail(input: IdentitySecurityTemplateInput): RenderedTransactionalEmail {
	if (input.type === "welcome") {
		return wrap("Welcome to Clipify", `Welcome to Clipify, ${input.name}.`, `<p>Welcome to Clipify, <strong>${escapeHtml(input.name)}</strong>.</p>`);
	}
	if (input.type === "invitation") {
		return wrap(`You were invited to ${headerText(input.organizationName)} on Clipify`, `Accept your Clipify team invitation: ${input.invitationUrl}`, `<p>You were invited to join <strong>${escapeHtml(input.organizationName)}</strong> on Clipify.</p><p><a href="${escapeHtml(input.invitationUrl)}">Accept invitation</a></p>`);
	}
	if (input.type === "security") {
		return wrap("Clipify security notice", input.message, `<p>${escapeHtml(input.message)}</p>`);
	}
	const verb = input.status === "granted" ? "granted" : "removed";
	return wrap(`Agency access ${verb} on Clipify`, `${input.agencyName} access to ${input.creatorName} was ${verb}.`, `<p><strong>${escapeHtml(input.agencyName)}</strong> access to <strong>${escapeHtml(input.creatorName)}</strong> was ${verb}.</p>`);
}

function wrap(subject: string, text: string, html: string): RenderedTransactionalEmail {
	return { subject: headerText(subject), text, html, templateVersion: "identity-security-v1" };
}

function headerText(value: string) {
	return value
		.replace(/[\r\n]+/g, " ")
		.trim()
		.slice(0, 160);
}

function escapeHtml(value: string) {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
