import { Card, CardContent } from "@components/heroui-client";
import RunnerEnrollForm from "./runner-enroll-form";

export default async function RunnerEnrollPage() {
	return (
		<main className='min-h-screen bg-background text-foreground flex items-center justify-center px-4'>
			<Card className='w-full max-w-md border border-border bg-card'>
				<CardContent className='flex flex-col gap-6 p-6'>
					<RunnerEnrollForm />
				</CardContent>
			</Card>
		</main>
	);
}
