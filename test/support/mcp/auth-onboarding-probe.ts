import { auth } from "@/auth/config";
import { dbPool } from "@/db/client";
async function main() {
	const email = process.argv[2],
		creatorId = process.argv[3];
	if (!email || !creatorId) throw new Error("ONBOARDING_PROBE_INPUT_REQUIRED");
	try {
		const context = await auth.$context;
		const result = await context.internalAdapter.createOAuthUser({ name: "OAuth Creator", email, emailVerified: true, image: null }, { accountId: creatorId, providerId: "twitch" });
		process.stdout.write(JSON.stringify({ authUserId: result.user.id, accountId: result.account.accountId }) + "\n");
	} finally {
		await dbPool.end();
	}
}
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
