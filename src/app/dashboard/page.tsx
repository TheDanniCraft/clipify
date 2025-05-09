import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromCoookie } from "@actions/auth";
import { getUser } from "@actions/database";
import OverlayTable from "@components/OverlayTable";
import { AuthenticatedUser } from "../lib/types";

export default async function Dashboard() {
	const cookieStore = await cookies();
	const token = cookieStore.get("token");
	const cookieUser = token ? ((await getUserFromCoookie(token.value)) as AuthenticatedUser | null) : null;

	if (!cookieUser) {
		return redirect("/login");
	}

	const user = await getUser(cookieUser.id);
	if (!user) {
		return redirect("/login");
	}

	return (
		<div className='flex flex-col items-center justify-center w-full h-full'>
			<h1 className='text-3xl font-bold'>Dashboard</h1>
			<p className='mt-4 text-lg'>Welcome to the dashboard {user.username}!</p>
			<OverlayTable userid={user.id} />
		</div>
	);
}
