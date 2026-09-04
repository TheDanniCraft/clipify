import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BadgeIcon from "@components/membership/BadgeIcon";
import BadgeGrid from "@components/membership/BadgeGrid";
import type { ReactNode } from "react";
import type { BadgeIconKey } from "@lib/badgeCatalog";
import type { MemberBadgeView } from "@lib/membership";

jest.mock("@heroui/react", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const State = React.createContext<{ open: boolean; setOpen: (open: boolean) => void }>({ open: false, setOpen: () => undefined });
	const Tooltip = ({ children, isOpen, onOpenChange }: { children: ReactNode; isOpen: boolean; onOpenChange: (open: boolean) => void }) => <State.Provider value={{ open: isOpen, setOpen: onOpenChange }}>{children}</State.Provider>;
	const Trigger = ({ children }: { children: ReactNode }) => {
		const { setOpen } = React.useContext(State);
		return (
			<div onMouseEnter={() => setOpen(true)} onFocus={() => setOpen(true)}>
				{children}
			</div>
		);
	};
	const Content = ({ children }: { children: ReactNode }) => {
		const { open } = React.useContext(State);
		return open ? <div role='tooltip'>{children}</div> : null;
	};
	return {
		Button: ({ children, onPress, "aria-label": label }: { children: ReactNode; onPress?: () => void; "aria-label"?: string }) => (
			<button aria-label={label} onClick={onPress}>
				{children}
			</button>
		),
		Tooltip: Object.assign(Tooltip, { Trigger, Content, Arrow: () => null }),
	};
});

const badge = { slug: "beta-tester", name: "Beta Tester", description: "Helped test Clipify early.", icon: "flask", priority: 80, awardedAt: new Date("2026-01-01") } as const satisfies MemberBadgeView;

describe("compact badge icons", () => {
	it("uses the beta icon without displaying a permanent description card", () => {
		const { container } = render(<BadgeGrid badges={[badge]} />);
		expect(screen.getByRole("list", { name: "Awarded badges" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Beta Tester: Helped test Clipify early." })).toBeInTheDocument();
		expect(container.querySelector('[data-badge-icon="flask"]')).toBeInTheDocument();
		expect(screen.queryByText(badge.description)).not.toBeInTheDocument();
	});
	it("reveals the badge name and description on hover", async () => {
		const user = userEvent.setup();
		render(<BadgeIcon badge={badge} />);
		await user.hover(screen.getByRole("button"));
		expect(await screen.findByRole("tooltip")).toHaveTextContent(badge.description);
	});
	it("reveals details with keyboard focus", async () => {
		const user = userEvent.setup();
		render(<BadgeIcon badge={badge} />);
		await user.tab();
		expect(await screen.findByRole("tooltip")).toHaveTextContent(badge.name);
	});
	it("allows pressing the icon to reveal details", async () => {
		const user = userEvent.setup();
		render(<BadgeIcon badge={badge} />);
		await user.click(screen.getByRole("button"));
		expect(await screen.findByRole("tooltip")).toHaveTextContent(badge.description);
	});
	it.each(["not-an-icon", "constructor", "https://example.com/icon.svg"])("falls back safely for an unknown catalog icon at runtime: %s", (icon) => {
		const malformed = { ...badge, slug: "custom", icon: icon as BadgeIconKey } as unknown as MemberBadgeView;
		const { container } = render(<BadgeIcon badge={malformed} />);
		expect(container.querySelector('[data-badge-icon="badge"]')).toBeInTheDocument();
	});
	it("honors a known catalog icon", () => {
		const { container } = render(<BadgeIcon badge={{ ...badge, icon: "star" }} />);
		expect(container.querySelector('[data-badge-icon="star"]')).toBeInTheDocument();
	});
});
