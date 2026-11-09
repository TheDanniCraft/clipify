import { defaultProgress, guideLocation, navigationForTask, routeForTask, stepsForTask, type TaskId } from "@/app/lib/userTour";
it("adds one short Explore Events step without creating an event", () => {
	const task = "explore.events" as TaskId;
	const progress = defaultProgress();
	expect(routeForTask(task, progress)).toBe("/dashboard/events");
	expect(guideLocation("/dashboard/events")).toBe("events");
	expect(navigationForTask(task, "dashboard", progress)).toEqual([]);
	const steps = stepsForTask(task, progress);
	expect(steps).toHaveLength(1);
	expect(steps[0]).toMatchObject({ target: "event-library", finish: true, next: true });
});
