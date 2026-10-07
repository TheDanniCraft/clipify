export const clientProfiles = [
	{ id: "chatgpt-web", product: "ChatGPT web", prerequisite: "Purpose-created ChatGPT account with remote connector access; interactive consent and host evidence" },
	{ id: "claude-web", product: "Claude web", prerequisite: "Purpose-created Claude web account with remote connector access; interactive consent and host evidence" },
	{ id: "codex-cli", product: "Codex CLI", prerequisite: "Authenticated Codex CLI configured against isolated reachable Clipify HTTPS origin" },
	{ id: "custom", product: "Official SDK independent client", prerequisite: "Disposable loopback Clipify fixture" },
] as const;

/** Required observations, never inferred merely from a profile name or fixture. */
export const clientAcceptanceAssertions = ["protected-resource-and-issuer-discovery", "public-client-registration-and-S256-PKCE", "actual-consent-approval-and-denial", "approved-creator-read-and-mutation", "current-backend-plan-limit-enforcement", "immediate-old-bearer-and-refresh-revocation", "observed-risk-hints-and-actual-host-prompt-behavior", "record-product-date-version-protocol-and-registration-path"] as const;
