import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { assertAdmin } from "../auth/auth.middleware.js";
import type { CrmAuthenticatedUser } from "../auth/auth.crypto.js";
import { HttpError } from "../../utils/http-error.js";

export const subgroupIdSchema = z.string().refine(value => /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n);
export const subgroupSchema = z.object({ name: z.string().trim().min(1).max(255) });

export async function resolveSubgroup(db: PrismaClient | Prisma.TransactionClient, value: string | undefined, categoryId: bigint | null | undefined) {
  if (!value) return null;
  const subgroup = await db.productSubgroup.findUnique({ where: { id: BigInt(value) } });
  if (!subgroup || subgroup.categoryId !== categoryId) throw new HttpError(400, "Subgroup must belong to the selected category.");
  return subgroup.id;
}

export async function saveSubgroup(actor: CrmAuthenticatedUser, categoryId: bigint, name: string, id?: bigint) {
  assertAdmin(actor);
  try {
    if (!await prisma.productCategory.findUnique({ where: { id: categoryId } })) throw new HttpError(404, "Category not found.");
    if (id !== undefined) {
      const result = await prisma.productSubgroup.updateMany({ where: { id, categoryId }, data: { name } });
      if (!result.count) throw new HttpError(404, "Subgroup not found.");
      return { id: id.toString() };
    }
    const group = await prisma.productSubgroup.create({ data: { categoryId, name } });
    return { id: group.id.toString() };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new HttpError(409, "A subgroup with this name already exists in this category.");
    throw error;
  }
}
export async function removeSubgroup(actor: CrmAuthenticatedUser, categoryId: bigint, id: bigint) {
  assertAdmin(actor);
  const result = await prisma.productSubgroup.deleteMany({ where: { id, categoryId } });
  if (!result.count) throw new HttpError(404, "Subgroup not found.");
}
