import { Button, Link } from "@heroui/react";
import { IconBrandTwitch } from "@tabler/icons-react";
import ErrorToast from "@components/errorToast";
import { getBaseUrl, isPreview } from "@actions/utils";
import { validateAuth } from "../actions/auth";
import { redirect } from "next/navigation";

export default async function Login({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
	const { error, errorCode, returnUrl } = await searchParams;

	const scopes: string[] = ["user:read:email", "channel:read:redemptions", "channel:manage:redemptions", "user:read:chat", "user:write:chat", "user:bot", "channel:bot"];

	let state = Buffer.from(
		JSON.stringify({
			returnUrl: returnUrl || null,
			date: new Date().toISOString(),
		})
	).toString("base64");

	const baseUrl = await getBaseUrl();
	let callbackUrl = new URL("/callback", baseUrl);

	const authLink = new URL("https://id.twitch.tv/oauth2/authorize");
	if ((await isPreview()) && process.env.PREVIEW_CALLBACK_URL) {
		state = Buffer.from(
			JSON.stringify({
				initiator: callbackUrl,
				returnUrl: returnUrl || null,
				date: new Date().toISOString(),
			})
		).toString("base64");
		callbackUrl = new URL(process.env.PREVIEW_CALLBACK_URL);
	}

	authLink.searchParams.append("client_id", process.env.TWITCH_CLIENT_ID || "");
	authLink.searchParams.append("redirect_uri", callbackUrl.toString());
	authLink.searchParams.append("response_type", "code");
	authLink.searchParams.append("scope", scopes.join(" "));
	authLink.searchParams.append("force_verify", "true");
	authLink.searchParams.append("state", state);

	const loggedInUser = await validateAuth();
	if (loggedInUser) {
		redirect("/dashboard");
	}

	return (
		<>
			<script src='//tag.goadopt.io/injector.js?website_code=792b9b29-57f9-4d92-b5f1-313f94ddfacc' className='adopt-injector' defer></script>

			<ErrorToast error={error as string} errorCode={errorCode as string} />
			<div className='min-h-screen min-w-screen flex items-center justify-center bg-gradient-to-br from-primary-800 to-primary-400'>
				<div className='flex flex-col items-center'>
					<Button as={Link} href={authLink.toString()} startContent={<IconBrandTwitch color='#8956FB' />} variant='faded' size='lg' color='default' aria-label='Login with Twitch'>
						Login with Twitch
					</Button>
					<div className='flex flex-col items-center text-xs text-gray-400 mt-1'>
						<p>By using this service, you agree to our </p>
						<p>
							<Link isExternal href='https://hub.goadopt.io/document/9651af3f-af45-480f-8a4d-2beb6ed68e9b?language=en' className='text-xs' color='foreground'>
								Terms of Service
							</Link>{" "}
							and{" "}
							<Link isExternal href='https://hub.goadopt.io/document/3852d930-97b9-46c2-950d-823e62515ab4?language=en' className='text-xs' color='foreground'>
								Privacy Policy
							</Link>
							.
						</p>
					</div>
				</div>
			</div>
		</>
	);
}
