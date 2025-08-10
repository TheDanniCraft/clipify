import { Button } from "@heroui/react";
import { IconBrandTwitch } from "@tabler/icons-react";
import ErrorToast from "@components/errorToast";

export default async function Login({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
	const scopes: string[] = ["user:read:email", "channel:read:redemptions", "channel:manage:redemptions", "user:write:chat", "user:bot", "channel:bot"];

	const state = Buffer.from(new Date().toISOString()).toString("base64");

	const authLink = new URL("https://id.twitch.tv/oauth2/authorize");
	authLink.searchParams.append("client_id", process.env.TWITCH_CLIENT_ID || "");
	authLink.searchParams.append("redirect_uri", process.env.TWITCH_CALLBACK_URL || "");
	authLink.searchParams.append("response_type", "code");
	authLink.searchParams.append("scope", scopes.join(" "));
	authLink.searchParams.append("force_verify", "true");
	authLink.searchParams.append("state", state);

	const { error, errorCode } = await searchParams;
	return (
		<>
			<ErrorToast error={error as string} errorCode={errorCode as string} />
			<div className='min-h-screen min-w-screen flex items-center justify-center bg-gradient-to-br from-primary-800 to-primary-400'>
				<div className='flex flex-col items-center'>
					<Button as='a' href={authLink.toString()} startContent={<IconBrandTwitch color='#8956FB' />} variant='faded' size='lg'>
						Login with Twitch
					</Button>
				</div>
			</div>
		</>
	);
}
