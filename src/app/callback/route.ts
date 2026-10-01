import { NextRequest } from "next/server";

import { authUser } from "@actions/auth";

export async function GET(request: NextRequest) {
	void request;
	return authUser(undefined, "legacyCallbackRetired");
}
