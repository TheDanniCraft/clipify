import { redirect } from "next/navigation";

export default function LegacyRolesSettingsPage() {
	redirect("/dashboard/settings/team");
}
