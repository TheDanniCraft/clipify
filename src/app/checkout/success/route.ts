import { NextResponse } from "next/server";

import { getBaseUrl } from "@actions/utils";
import { clearCheckoutIntent } from "@/server/checkoutIntent";

export async function GET() {
	await clearCheckoutIntent();
	return NextResponse.redirect(new URL("/dashboard/settings?tab=billing&checkout=success", await getBaseUrl()));
}
