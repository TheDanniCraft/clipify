export type McpConnection = { id: string; clientId: string; clientName: string; scopes: string[]; creatorIds: string[]; creatorPermissions?: { creatorId: string; scopes: string[] }[]; createdAt: string; expiresAt: string; revokedAt: string | null; active: boolean };

export type McpActivityItem = { id: string; occurredAt: string; actor: { id: string | null; name: string }; client: { id: string | null; name: string }; creator: { id: string; name: string }; tool: string; outcome: "success" | "denied" | "error"; reason: string | null };
export type McpActivityPage = { items: McpActivityItem[]; nextCursor: string | null };
