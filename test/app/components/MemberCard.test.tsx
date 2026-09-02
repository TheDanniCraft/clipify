import { fireEvent, render, screen } from "@testing-library/react";
import MemberCard from "@components/membership/MemberCard";
import type { MemberProfile } from "@lib/membership";

const profile: MemberProfile = {
	cardId: "025dcf9a-10f5-47ad-a6f0-cbe1151b6fbc",
	username: "clipper",
	avatar: "https://static-cdn.jtvnw.net/avatar.png",
	memberNumber: null,
	joinedAt: new Date("2026-01-02T00:00:00Z"),
	badges: [],
};

describe("MemberCard", () => {
	beforeEach(() => {
		Object.defineProperty(window, "matchMedia", { configurable: true, value: jest.fn(() => ({ matches: false })) });
	});

	it("shows the stored join date and avatar while the number is pending", () => {
		render(<MemberCard profile={profile} />);
		expect(screen.getByText("Jan 2, 2026")).toBeInTheDocument();
		expect(screen.getByText("Pending")).toBeInTheDocument();
		expect(screen.queryByText("Pending backfill")).not.toBeInTheDocument();
		expect(screen.getByRole("img", { name: "clipper's avatar" })).toHaveAttribute("src", profile.avatar);
		expect(screen.getByText("Clipify")).toBeInTheDocument();
	});

	it("falls back to initials for a failed avatar", () => {
		render(<MemberCard profile={profile} />);
		fireEvent.error(screen.getByRole("img", { name: "clipper's avatar" }));
		expect(screen.getByText("CL")).toBeInTheDocument();
	});

	it("shows awarded badges and keeps the stored date for member zero", () => {
		render(<MemberCard profile={{ ...profile, memberNumber: 0, badges: [{ slug: "founder", name: "Founder", description: "", icon: null, awardedAt: new Date() }] }} />);
		expect(screen.getByText("Founder")).toBeInTheDocument();
		expect(screen.getByText("Early member")).toBeInTheDocument();
		expect(screen.getByText("Jan 2, 2026")).toBeInTheDocument();
	});

	it("updates the foil position and tilt, then resets when the pointer leaves", () => {
		render(<MemberCard profile={profile} />);
		const card = screen.getByRole("article");
		const stage = card.parentElement!;
		jest.spyOn(stage, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 360, height: 530 } as DOMRect);
		fireEvent(stage, new MouseEvent("pointermove", { bubbles: true, clientX: 270, clientY: 265 }));
		expect(card.dataset.active).toBe("true");
		expect(card.style.getPropertyValue("--pointer-x")).toBe("75%");
		expect(card.style.getPropertyValue("--rotate-y")).toBe("4deg");
		fireEvent.pointerLeave(stage);
		expect(card.dataset.active).toBe("false");
		expect(card.style.getPropertyValue("--rotate-y")).toBe("0deg");
	});

	it.each(["reduced motion", "touch"])("does not tilt for %s", (mode) => {
		if (mode === "reduced motion") jest.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
		render(<MemberCard profile={profile} />);
		const card = screen.getByRole("article");
		const event = new MouseEvent("pointermove", { bubbles: true, clientX: 10, clientY: 10 });
		Object.defineProperty(event, "pointerType", { value: mode === "touch" ? "touch" : "mouse" });
		fireEvent(card.parentElement!, event);
		expect(card.dataset.active).toBeUndefined();
	});
});
