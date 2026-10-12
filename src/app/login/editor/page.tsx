import { getAuthSession } from "@/auth/session";
import { safeReturnPath } from "@/auth/return-url";
import EditorSignIn from "./EditorSignIn";

export default async function EditorLogin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	const parameters = await searchParams;
	const oauthAuthorization = typeof parameters.client_id === "string" && typeof parameters.sig === "string";
	const session = await getAuthSession();
	return <EditorSignIn returnUrl={safeReturnPath(parameters.returnUrl) ?? "/dashboard"} signedInEmail={oauthAuthorization ? null : (session?.user.email ?? null)} />;
}
