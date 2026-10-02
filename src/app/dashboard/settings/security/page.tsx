import { redirect } from "next/navigation";

export default function LegacySecuritySettingsPage() {
	redirect("/dashboard/settings#security");
}
