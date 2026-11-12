import { render } from "@testing-library/react";
import EventPodiumCelebration from "@/app/components/events/EventPodiumCelebration";

it("celebrates the winner, with no confetti for runners-up", () => {
	const view = render(<EventPodiumCelebration place={3} immediate={false} arrival={1.55} cueStart={0.55} cueDuration={0.45} />);
	expect(document.querySelector("[data-award-podium-cue]")).toHaveTextContent("Third place");
	expect(document.querySelector("[data-award-confetti]")).toBeNull();
	view.rerender(<EventPodiumCelebration place={1} immediate={false} arrival={1.95} cueStart={0.55} cueDuration={0.85} />);
	expect(document.querySelector("[data-award-podium-cue]")).toHaveTextContent("And the award goes to…");
	expect(document.querySelector("[data-award-confetti]")).not.toBeNull();
});

it("restores the podium immediately without replaying buildup or confetti on Back/reduced motion", () => {
	render(<EventPodiumCelebration place={1} immediate arrival={1.95} cueStart={0.55} cueDuration={0.85} />);
	expect(document.querySelector("[data-award-podium='1']")).not.toBeNull();
	expect(document.querySelector("[data-award-podium-cue]")).toBeNull();
	expect(document.querySelector("[data-award-confetti]")).toBeNull();
});

it("holds a host-controlled place announcement until the reveal replaces it", () => {
	const view = render(<EventPodiumCelebration place={3} immediate={false} arrival={0} cueStart={0.55} cueDuration={0} cueOnly />);
	expect(document.querySelector("[data-award-podium-cue]")).toHaveTextContent("Third place");
	expect(document.querySelector("[data-award-podium]")).toBeNull();
	view.rerender(<EventPodiumCelebration place={3} immediate={false} arrival={0.55} cueStart={0} cueDuration={0} announced />);
	expect(document.querySelector("[data-award-podium-cue]")).toBeNull();
	expect(document.querySelector("[data-award-podium='3']")).not.toBeNull();
});
