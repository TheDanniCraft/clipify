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
		const Agenda = new Proxy(Root, { get: (target, key) => (typeof key === "string" && /^[A-Z]/.test(key) ? Box : Reflect.get(target, key)) });
		return { Agenda, useAgenda: (options: Record<string, unknown>) => ({ ...options, view: options.view ?? options.defaultView ?? "week", visibleDays: [], visibleWeeks: [], allDayLayout: [], heading: "Calendar", getEventsForDay: () => [], goToPrevious: jest.fn(), goToNext: jest.fn(), goToToday: jest.fn() }) };
	},
	{ virtual: true },
);
jest.mock("react-aria-components/I18nProvider", () => ({ useLocale: () => ({ locale: "en-US" }) }));
beforeEach(() => {
	Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }) });
});
test("UX-C5: the calendar honors the selected event timezone rather than resetting to UTC", () => {
	render(<RunnerScheduleAgenda now={Date.now()} events={[]} canEdit onCreate={jest.fn()} onEdit={jest.fn()} timezone='Europe/Berlin' />);
	expect(mockAgendaProps.mock.calls.at(-1)?.[0].timeZone).toBe("Europe/Berlin");
});

test("opening an event preserves its saved timezone and wall times when the calendar uses another timezone", () => {
	const date = new Date().toISOString().slice(0, 10);
	const onEdit = jest.fn();
	render(<RunnerScheduleAgenda now={Date.now()} events={[{ id: "saved", title: "Berlin event", timezone: "Europe/Berlin", configurationRevision: 1, recurrence: "once", recurrenceAnchor: "original", localStartDate: date, localEndDate: date, localStartTime: "12:00", localEndTime: "13:00", weekdays: [], endDayOffset: 0, enabled: true }]} canEdit onCreate={jest.fn()} onEdit={onEdit} timezone='UTC' />);
	const props = mockAgendaProps.mock.calls.at(-1)![0];
	props.onEventSelect(props.events[0].id);
	expect(onEdit.mock.calls[0][1]).toMatchObject({ timezone: "Europe/Berlin", localStartTime: "12:00", localEndTime: "13:00" });
});
