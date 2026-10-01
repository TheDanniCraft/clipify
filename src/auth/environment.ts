type AuthEnvironment = Readonly<Record<string, string | undefined>>;

function generationFallback(name: string, environment: AuthEnvironment, argv: string[]): string | undefined {
	const controlledGeneration = argv.includes("generate") || environment.APP_ENV === "test" || environment.CLIPIFY_BUILD_PHASE === "1";
	if (!controlledGeneration) return undefined;
	if (name === "BETTER_AUTH_SECRET") return "schema-generation-only-secret-at-least-32-characters";
	return `schema-generation-${name.toLowerCase()}`;
}

export function requiredAuthSetting(name: string, legacyName?: string, environment: AuthEnvironment = process.env, argv: string[] = process.argv): string {
	const value = environment[name] ?? (legacyName ? environment[legacyName] : undefined) ?? generationFallback(name, environment, argv);
	if (!value) throw new Error(`${name} must be injected by Infisical`);
	return value;
}
