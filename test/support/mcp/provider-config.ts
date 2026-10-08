import { betterAuth } from "better-auth";
import { jwt, organization } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { mcp } from "@better-auth/mcp";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
// Schema introspection only: no database connection or production settings.
export const auth = betterAuth({
	baseURL: "http://127.0.0.1:3107",
	secret: "mcp-schema-fixture-secret-32-characters",
	plugins: [organization({ dynamicAccessControl: { enabled: true } }), passkey(), jwt(), mcp({ loginPage: "/auth/login", consentPage: "/auth/mcp/consent", resource: "http://127.0.0.1:3107/mcp", allowDynamicClientRegistration: true, allowUnauthenticatedClientRegistration: true }), cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" })],
});
