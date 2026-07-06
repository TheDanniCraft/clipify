import { Link } from "@components/heroui-client";
import { buttonVariants } from "@heroui/styles";

import { IconBrandTwitch } from "@tabler/icons-react";
import ErrorToast from "@components/errorToast";
import { validateAuth } from "@actions/auth";
import { redirect } from "next/navigation";
import NextLink from "next/link";

export default async function Login({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
	const { error, errorCode, returnUrl } = await searchParams;

	const loggedInUser = await validateAuth();
	if (loggedInUser) {
		redirect("/dashboard");
	}

	const ru = typeof returnUrl === "string" ? returnUrl : "";

	return (
		<>
			<ErrorToast error={error as string} errorCode={errorCode as string} />

			<div className='min-h-screen min-w-screen flex items-center justify-center bg-gradient-to-br from-brand-800 to-brand-400'>
				<div className='flex flex-col items-center'>
					<NextLink href={`/auth${ru ? `?returnUrl=${encodeURIComponent(ru)}` : ""}`} aria-label='Login with Twitch' className={buttonVariants({ variant: "tertiary", size: "lg" })}>
						<IconBrandTwitch color='#8956FB' />
						Login with Twitch
					</NextLink>

					<div className='mt-2 flex max-w-[240px] flex-col items-center text-center text-xs text-gray-400'>
						<p>
							By logging in, you agree to our{" "}
							<Link href='https://hub.goadopt.io/document/9651af3f-af45-480f-8a4d-2beb6ed68e9b?language=en' className='text-xs text-foreground' target='_blank' rel='noopener noreferrer'>
								Terms
							</Link>{" "}
							and{" "}
							<Link href='https://hub.goadopt.io/document/3852d930-97b9-46c2-950d-823e62515ab4?language=en' className='text-xs text-foreground' target='_blank' rel='noopener noreferrer'>
								Privacy
							</Link>
							. We send you product update emails by default. You can opt out anytime.
						</p>
					</div>
				</div>
			</div>
		</>
	);
}
