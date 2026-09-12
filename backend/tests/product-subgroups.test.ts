import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { resolveSubgroup, subgroupIdSchema, subgroupSchema } from "../src/modules/admin/product-subgroups.js";

function database(group: { id: bigint; categoryId: bigint } | null) {
  return { productSubgroup: { findUnique: async () => group } } as unknown as PrismaClient;
}
test("subgroup is optional", async () => {
  assert.equal(await resolveSubgroup(database(null), "", 1n), null);
  assert.equal(await resolveSubgroup(database(null), undefined, 1n), null);
});
test("subgroup must belong to the selected category", async () => {
  assert.equal(await resolveSubgroup(database({ id: 2n, categoryId: 1n }), "2", 1n), 2n);
  await assert.rejects(resolveSubgroup(database({ id: 2n, categoryId: 3n }), "2", 1n));
  await assert.rejects(resolveSubgroup(database(null), "2", 1n));
});
test("subgroup name is trimmed and bounded", () => {
  assert.equal(subgroupSchema.parse({ name: " 250 мл " }).name, "250 мл");
  assert.equal(subgroupSchema.safeParse({ name: " " }).success, false);
  assert.equal(subgroupSchema.safeParse({ name: "x".repeat(256) }).success, false);
});
test("subgroup route IDs fit PostgreSQL bigint", () => {
  for (const id of ["0", "-1", "abc", "9223372036854775808"]) assert.equal(subgroupIdSchema.safeParse(id).success, false);
  assert.equal(subgroupIdSchema.safeParse("1").success, true);
});
