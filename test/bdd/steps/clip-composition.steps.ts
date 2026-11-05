import { createBdd } from "playwright-bdd";
import { test, type TourWorld } from "../support/user-tour";
import { prepareCompositionExports, downloadCompositionExports, verifyCompositionExports, type CompositionExportState } from "../../support/clip-composition-export";
const { Given, When, Then } = createBdd(test);
const cases = new WeakMap<TourWorld, CompositionExportState>();
Given("a creator has named Desktop and Mobile layouts and an isolated clip override", async ({ page, request, tourWorld }) => {
	test.info().setTimeout(120000);
	cases.set(tourWorld, await prepareCompositionExports({ page, request, tourWorld }));
});
When("I export Original plus one Desktop and two Mobile versions", async ({ page, request, tourWorld }) => {
	await downloadCompositionExports({ page, request, tourWorld }, cases.get(tourWorld)!, test.info());
});
Then("four complete videos apply my clip override without changing global or foreign layouts", async ({ page, request, tourWorld }) => {
	await verifyCompositionExports({ page, request, tourWorld }, cases.get(tourWorld)!, test.info());
});
