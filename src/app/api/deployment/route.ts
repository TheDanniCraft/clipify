import { DEPLOYMENT_ID_HEADER, getDeploymentId } from "@lib/deployment";

export const dynamic = "force-dynamic";

export function GET() {
	return new Response(null, {
		status: 204,
		headers: {
			"Cache-Control": "no-store, max-age=0",
			[DEPLOYMENT_ID_HEADER]: getDeploymentId(),
		},
	});
}
