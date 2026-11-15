import { withDatabaseRequest } from "@/db/request-scope";
import { handleConnectedAppRequest } from "@/server/connected-apps/gateway";
export const runtime = "nodejs";
export const POST = (request: Request) => withDatabaseRequest(request.signal, () => handleConnectedAppRequest(request));
