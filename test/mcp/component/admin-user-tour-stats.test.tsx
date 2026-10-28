jest.mock("@heroui/react", () => require("../../support/mcp/heroui-fixture").components);
import { render, screen } from "@testing-library/react";
import AdminUserTourStats from "@/app/components/adminUserTourStats";
import sample from "../../../grafana/mcp-health-sample.json";

test("admin shows shared guide metrics with explicit completion semantics and section rows", () => {
	render(<AdminUserTourStats stats={sample.onboarding} />);
	expect(screen.getByRole("heading", { name: "Onboarding guides" })).toBeVisible();
	expect(screen.getByText(/Skipped tasks do not count as completed/)).toBeVisible();
	expect(screen.getByText(/3 accounts have no saved guide record/)).toBeVisible();
	expect(screen.getByRole("grid", { name: "Onboarding completion by guide section" })).toBeVisible();
	for (const section of Object.values(sample.onboarding.sections)) expect(screen.getByText(section.title)).toBeVisible();
	expect(screen.getByRole("status")).toHaveTextContent("Unreadable guide records: 1");
});
test("empty guide population is explicit and does not display a misleading completion percentage", () => {
	render(<AdminUserTourStats stats={{ ...sample.onboarding, trackedAccounts: 0, accountsWithProgress: 0, completedAccounts: 0, completedTasks: 0, skippedTasks: 0, invalidProgressAccounts: 0, completionRate: 0, averageProgress: 0 }} />);
	expect(screen.getByText("No guide progress recorded yet.")).toBeVisible();
	expect(screen.queryByRole("grid")).not.toBeInTheDocument();
	expect(screen.queryByText(/NaN|Infinity|0\.0%/)).not.toBeInTheDocument();
});
