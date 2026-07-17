import { Card, CardContent } from "@components/heroui-client";
import RunnerEnrollForm from "./runner-enroll-form";
import { isValidUserCode, normalizeUserCode } from "./code";

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
