import { getC15t } from "@lib/consent/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = (request: Request) => getC15t().handler(request);

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
