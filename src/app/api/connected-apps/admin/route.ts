import { withDatabaseRequest } from "@/db/request-scope";
import { handleConnectedAppAdminRequest } from "@/server/connected-apps/admin";
export const runtime = "nodejs";
export const POST = (request: Request) => withDatabaseRequest(request.signal, () => handleConnectedAppAdminRequest(request));
