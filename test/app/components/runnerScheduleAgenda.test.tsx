import { render } from "@testing-library/react";
jest.mock("@/app/components/runner/ScheduleFields", () => ({ ScheduleDateField: () => null, ScheduleTimeField: () => null, TimezonePicker: () => null }));
import RunnerScheduleAgenda from "@/app/components/runnerScheduleAgenda";
const mockAgendaProps = jest.fn();
jest.mock(
	"@heroui-pro/react",
	() => {
		const Box = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
		const Root = ({ children, ...props }: { children?: React.ReactNode }) => {
			mockAgendaProps(props);
			return <>{children}</>;
		};
		const Agenda = new Proxy(Root, { get: () => Box });
		return { Agenda, useAgenda: (options: Record<string, unknown>) => ({ ...options, view: options.view ?? options.defaultView ?? "week", visibleDays: [], visibleWeeks: [], heading: "Calendar", getEventsForDay: () => [], goToPrevious: jest.fn(), goToNext: jest.fn(), goToToday: jest.fn() }) };
	},
	{ virtual: true },
);
jest.mock("react-aria-components/I18nProvider", () => ({ useLocale: () => ({ locale: "en-US" }) }));
beforeEach(() => {
	Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }) });
});
test("UX-C5: the calendar honors the selected event timezone rather than resetting to UTC", () => {
	render(<RunnerScheduleAgenda events={[]} canEdit onCreate={jest.fn()} onEdit={jest.fn()} timezone='Europe/Berlin' />);
	expect(mockAgendaProps.mock.calls.at(-1)?.[0].timeZone).toBe("Europe/Berlin");
});
