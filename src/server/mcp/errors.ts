import { toPublicResourceError } from "@/server/resources/errors";

/** Transport envelope around the common safe business-error projection. */
export function toolFailure(cause: unknown) {
	const error = toPublicResourceError(cause);
	return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(error) }], structuredContent: { error } };
}
