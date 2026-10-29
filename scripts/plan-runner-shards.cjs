/* eslint-disable @typescript-eslint/no-require-imports */
const { runnerTestInventory, planRunnerShards } = require("./runner-test-sharding.cjs"),
	{ mkdirSync, writeFileSync, appendFileSync } = require("node:fs");
const owners = runnerTestInventory(),
	shards = planRunnerShards(owners);
mkdirSync("test-results", { recursive: true });
writeFileSync("test-results/runner-shard-plan.json", JSON.stringify({ owners, shards }, null, 2) + "\n");
const matrix = { include: shards.map((_, i) => ({ index: i + 1, shard: `${i + 1}/${shards.length}`, label: `runner-${i + 1}` })) };
console.log(`Runner plan: ${owners.length} complete files across ${shards.length} isolated shards (five-minute estimated-work target).`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify(matrix)}\ncount=${shards.length}\n`);
