import { redirect } from "next/navigation";
import { validateAuth } from "@actions/auth";
export default async function ClipLayoutPage({ searchParams }: { searchParams: Promise<{ clips?: string }> }) {
	const user = await validateAuth();
	if (!user) redirect("/logout");
	const { clips } = await searchParams;
	const clip = typeof clips === "string" ? clips.split(",")[0] : undefined;
	redirect(`/dashboard/clip-layouts${clip && /^[a-zA-Z0-9_-]{1,200}$/.test(clip) ? `?reference=${encodeURIComponent(clip)}` : ""}`);
}
