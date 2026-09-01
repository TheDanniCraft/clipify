import { validateAuth } from "@actions/auth";
import DashboardNavbar from "@components/dashboardNavbar";
import BadgeGrid from "@components/membership/BadgeGrid";
import MemberCard from "@components/membership/MemberCard";
import MemberCardActions from "@components/membership/MemberCardActions";
import { getMemberProfile } from "@lib/membership";
import { Card } from "@heroui/react";
import { IconAward } from "@tabler/icons-react";
import { notFound, redirect } from "next/navigation";

export default async function MemberCardPage() {
	const user = await validateAuth();
	if (!user) redirect("/logout");

	const profile = await getMemberProfile(user.id);
	if (!profile) notFound();

	return (
		<DashboardNavbar user={user} title='Member Card' tagline='Your place in the Clipify community'>
			<main className='mx-auto grid w-full max-w-5xl gap-8 px-4 py-8 lg:grid-cols-[minmax(280px,360px)_1fr] lg:items-start lg:px-8'>
				<div className='flex flex-col items-center gap-4'>
					<MemberCard profile={profile} />
					<MemberCardActions username={profile.username} imageUrl={`/api/member-card/public/${encodeURIComponent(profile.username)}`} />
				</div>

				<Card className='w-full'>
					<Card.Header>
						<div className='flex size-10 items-center justify-center rounded-xl bg-accent/12 text-accent'>
							<IconAward aria-hidden='true' size={22} />
						</div>
						<div>
							<Card.Title>Your badges</Card.Title>
							<Card.Description>Permanent recognition that becomes part of your Clipify identity.</Card.Description>
						</div>
					</Card.Header>
					<Card.Content>
						<BadgeGrid badges={profile.badges} />
					</Card.Content>
				</Card>
			</main>
		</DashboardNavbar>
	);
}
