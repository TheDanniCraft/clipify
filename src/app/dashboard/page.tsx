import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromCoookie } from "@actions/auth";
import { getUser } from "@actions/database";
import OverlayTable from "@components/OverlayTable";
import DashboardNavbar from "@components/dashboardNavbar";
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
		<DashboardNavbar user={user}>
			<OverlayTable userid={user.id} />
		</DashboardNavbar>
	);
}
