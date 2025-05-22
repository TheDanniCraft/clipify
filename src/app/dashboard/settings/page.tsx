import { validateAuth } from "@/app/actions/auth";
import DashboardNavbar from "@/app/components/dashboardNavbar";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
	const user = await validateAuth();
	if (!user) {
		redirect("/logout");
	}

	return (
		<DashboardNavbar user={user} title='Settings' tagline='Manage your settings'>
			<div className='flex flex-col items-center justify-center w-full h-full'>
				<h1 className='text-2xl font-bold'>Settings</h1>
				<p className='mt-4 text-gray-500'>This is the settings page.</p>
			</div>
		</DashboardNavbar>
	);
}
