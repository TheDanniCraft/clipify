import { render, screen } from "@testing-library/react";
import type { HTMLAttributes, ReactNode } from "react";

import { Plan } from "@types";

import CommunityHeroAvatars from "@/app/community/community-hero-avatars";
import CommunityTeaser from "@/app/components/LandingPage/communityTeaser";
import type { CommunityTeaserStreamer } from "@/app/lib/community-types";

jest.mock("@heroui/react", () => {
	function Avatar({ children, color: _color, variant: _variant, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode; color?: string; variant?: string }) {
		return <div {...props}>{children}</div>;
	}

	function AvatarImage({ alt: _alt, src }: { alt?: string; src?: string }) {
		return <span data-avatar-src={src} />;
	}

	function AvatarFallback({ children }: { children: ReactNode }) {
		return <span>{children}</span>;
	}

	Avatar.Image = AvatarImage;
	Avatar.Fallback = AvatarFallback;

	return { Avatar };
});

const streamers: CommunityTeaserStreamer[] = [
	{ id: "clipify-live", avatar: "/clipify-live.png", displayName: "Clipify Live", plan: Plan.Pro, partner: false, status: "live_with_overlay" },
	{ id: "twitch-live", avatar: "/twitch-live.png", displayName: "Twitch Live", plan: Plan.Free, partner: false, status: "live" },
	{ id: "partner", avatar: "/partner.png", displayName: "Partner", plan: Plan.Pro, partner: true, status: "offline" },
	{ id: "pro", avatar: "/pro.png", displayName: "Pro", plan: Plan.Pro, partner: false, status: "offline" },
	{ id: "offline", avatar: "/offline.png", displayName: "Offline", plan: Plan.Free, partner: false, status: "offline" },
];

describe("community avatar stacks", () => {
	it("renders semantic rings and the uncapped community-page overflow count", () => {
		render(<CommunityHeroAvatars streamers={streamers} totalCount={80} />);

		expect(screen.getByLabelText("Clipify Live: Live with Clipify")).toHaveClass("ring-success");
		expect(screen.getByLabelText("Twitch Live: Live on Twitch")).toHaveClass("ring-danger");
		expect(screen.getByLabelText("Partner: Clipify Partner")).toHaveClass("ring-warning");
		expect(screen.getByLabelText("Pro: Clipify Pro")).toHaveClass("ring-accent");
		expect(screen.getByLabelText("Offline: Offline")).toHaveClass("ring-default");
		expect(screen.getByText("+75 more")).toHaveClass("shrink-0", "whitespace-nowrap");
	});

	it("keeps the shared teaser overflow label whole", () => {
		render(<CommunityTeaser streamers={streamers} totalCount={85} />);

		expect(screen.getByText("+80 more")).toHaveClass("shrink-0", "whitespace-nowrap");
	});
});
