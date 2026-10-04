export function toDeploymentId(value: unknown) {
	if (typeof value !== "string") return "";
	return value
		.trim()
		.replace(/[^a-zA-Z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "");
}
