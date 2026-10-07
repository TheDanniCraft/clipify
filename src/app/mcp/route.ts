import { handleMcpRequest } from "@/server/mcp/server";
export const runtime = "nodejs";
export const POST = handleMcpRequest;
export const GET = handleMcpRequest;
export const DELETE = handleMcpRequest;
export const OPTIONS = handleMcpRequest;
