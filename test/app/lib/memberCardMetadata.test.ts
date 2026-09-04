/** @jest-environment node */
import { generateMetadata as memberMetadata } from "@/app/members/[cardId]/page";
import { generateMetadata as creatorMetadata } from "@/app/creators/[twitchUsername]/page";
import { getPublicMemberProfile } from "@lib/membership";
import { getCreatorPageMetadata } from "@actions/creatorPage";
import { clipifyShareDescription } from "@lib/memberCardShare";

jest.mock("@lib/membership", () => ({ getPublicMemberProfile: jest.fn() }));
jest.mock("@actions/creatorPage", () => ({ getCreatorPageMetadata: jest.fn() }));
jest.mock("@components/membership/BadgeGrid", () => () => null);
jest.mock("@components/membership/MemberCard", () => () => null);
jest.mock("@components/membership/MemberCardActions", () => () => null);
jest.mock("@components/creator/CreatorPageClient", () => () => null);
jest.mock("@components/footer", () => () => null);
jest.mock("@components/LandingPage/basicNavbar", () => () => null);

const cardId = "5e514012-3dde-84b7-a480-fadc254c4a33";
const image = `/api/member-card/public/${cardId}`;

describe("member card social previews", () => {
	beforeEach(() => jest.resetAllMocks());
	it("explains Clipify in the public member link preview", async () => {
		jest.mocked(getPublicMemberProfile).mockResolvedValue({ cardId, username: "clipper", avatar: "", memberNumber: null, joinedAt: new Date(), badges: [] });
		const metadata = await memberMetadata({ params: Promise.resolve({ cardId }) });
		expect(metadata.description).toContain(clipifyShareDescription);
		expect(metadata.openGraph).toMatchObject({ description: metadata.description, images: [{ url: image }] });
		expect(metadata.twitter).toMatchObject({ description: metadata.description, images: [image] });
	});
	it("uses the derived UUID rather than the creator username for social images", async () => {
		jest.mocked(getCreatorPageMetadata).mockResolvedValue({ username: "clipper", memberCardId: cardId, visibility: "discoverable" } as NonNullable<Awaited<ReturnType<typeof getCreatorPageMetadata>>>);
		const metadata = await creatorMetadata({ params: Promise.resolve({ twitchUsername: "clipper" }) });
		expect(metadata.openGraph).toMatchObject({ images: [{ url: image }] });
		expect(metadata.twitter).toMatchObject({ images: [image] });
	});
});
