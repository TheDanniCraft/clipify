import type { Metadata } from "next";
import { Card, CardContent } from "@components/heroui-client";
import RunnerEnrollForm from "./runner-enroll-form";
import { isValidUserCode, normalizeUserCode } from "./code";

export const metadata: Metadata = {
	title: "Connect your Runner | Clipify",
	description: "Connect your self-hosted Clipify Runner using its device code.",
	alternates: { canonical: "https://clipify.us/runner/enroll" },
	openGraph: { title: "Connect your Runner | Clipify", url: "https://clipify.us/runner/enroll" },
	robots: { index: false, follow: false },
};

export default async function RunnerEnrollPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
	const rawCode = (await searchParams).code;
	const codeValue = Array.isArray(rawCode) ? rawCode[0] : rawCode;
	const normalizedCode = typeof codeValue === "string" ? normalizeUserCode(codeValue) : "";
	const initialCode = isValidUserCode(normalizedCode) ? normalizedCode : undefined;
	return (
		<main className='min-h-screen bg-background text-foreground flex items-center justify-center px-4'>
			<Card className='w-full max-w-md border border-border bg-card'>
				<CardContent className='flex flex-col gap-6 p-6'>
					<RunnerEnrollForm initialCode={initialCode} />
				</CardContent>
			</Card>
		</main>
	);
}
