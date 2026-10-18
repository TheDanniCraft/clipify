/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

test("TDD-US1-FR005: session mutations publish their deferred effect only after the actual transaction commits", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:manual_commit_success");
	expect(result).toEqual({ transactionCommitted: true, rejected: false, sideEffects: [true], name: "After transaction", audits: 1, retries: 0 });
});

test("TDD-US1-FR005: a rolled-back session mutation publishes no effect and leaves no success audit or OAuth retry", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:manual_commit_rollback");
	expect(result).toEqual({ transactionCommitted: false, rejected: true, sideEffects: [], name: "Before transaction", audits: 0, retries: 0 });
});
