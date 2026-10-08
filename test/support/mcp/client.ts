import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
export async function connectMcpClient(url: URL, accessToken: string, mode: "legacy" | "auto" = "legacy") {
	const client = new Client({ name: "clipify-isolated-test-client", version: "1.0.0" }, { versionNegotiation: { mode } });
	const transport = new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${accessToken}` } } });
	await client.connect(transport);
	return { client, close: () => client.close() };
}
