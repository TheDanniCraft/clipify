import { redirect } from "next/navigation";

export default function LegacyEmbedPage() {
	redirect("/dashboard/tools?tool=player");
}
