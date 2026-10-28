type Location = { file: string; pointer: string };

const overrides: Record<string, [string, string]> = {
	"identity.providerAccounts": ["security", "providerAccounts"],
	"identity.sessions": ["security", "sessions"],
	"identity.passkeys": ["security", "passkeys"],
	"identity.creatorAccounts": ["connections", "creatorAccounts"],
	"identity.identityLinks": ["connections", "identityLinks"],
	"content.runners": ["runner", "runners"],
	"content.enrollments": ["runner", "enrollments"],
	"content.streamSessions": ["runner", "streamSessions"],
	"aiApps.accessTokens": ["security", "tokens/access"],
	"aiApps.refreshTokens": ["security", "tokens/refresh"],
	"aiApps.retryRecords": ["activity", "aiRetries"],
	"ownedAgencies.accounts": ["account", "agencyAccounts"],
	"ownedAgencies.billing": ["billing", "agencyBilling"],
	"external.newsletter": ["account", "newsletter"],
	"external.support": ["support", ""],
	verificationRecords: ["security", "verificationRecords"],
};
const sections: Record<string, [string, string]> = {
	identity: ["account", ""],
	organization: ["account", "team"],
	agency: ["account", "agency"],
	privacy: ["account", "privacy"],
	content: ["content", ""],
	clipStorage: ["clips", ""],
	runner: ["runner", ""],
	mcp: ["connections", ""],
	aiApps: ["connections", ""],
	reusableCredentials: ["security", "credentials"],
	accountLifecycle: ["activity", ""],
	accountActivity: ["activity", "accountAccess"],
	analytics: ["activity", "analytics"],
	billing: ["billing", ""],
};

export function createAccountExportLayout(data: Record<string, unknown>) {
	const documents: Record<string, Record<string, unknown>> = {};
	const locations = new Map<string, Location>();
	for (const [section, content] of Object.entries(data)) {
		if (["exportFormat", "exportedAt", "securityNotice"].includes(section)) continue;
		const entries = content && typeof content === "object" && !Array.isArray(content) ? Object.entries(content).map(([key, value]) => [`${section}.${key}`, value] as const) : [[section, content] as const];
		for (const [source, value] of entries) {
			const destination = overrides[source] ?? (sections[section] && [sections[section][0], [sections[section][1], source.slice(section.length + 1)].filter(Boolean).join("/")]);
			if (!destination) throw new Error(`ACCOUNT_EXPORT_LAYOUT_MISSING: ${source}`);
			if (value === null || value === undefined || (typeof value === "object" && !Object.keys(value).length)) continue;
			if (section === "external" && !(value as { contacts?: unknown[]; conversations?: unknown[] }).contacts?.length && !(value as { conversations?: unknown[] }).conversations?.length) continue;
			const [category, key] = destination;
			const file = `${category}/${category === "support" ? "conversations" : category}.json`;
			const document = (documents[file] ??= {});
			const storedValue = section === "external" ? Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([field]) => !["status", "description"].includes(field))) : value;
			if (!key) Object.assign(document, structuredClone(storedValue));
			else {
				const keys = key.split("/");
				let target = document;
				for (const part of keys.slice(0, -1)) target = (target[part] ??= {}) as Record<string, unknown>;
				target[keys.at(-1)!] = structuredClone(storedValue);
			}
			locations.set(source, { file, pointer: key ? `/${key}` : "" });
		}
	}
	return { documents, locations };
}
