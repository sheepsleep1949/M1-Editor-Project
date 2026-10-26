import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";
export type DbTx = Prisma.TransactionClient;
export const db = new PrismaClient();
export const withTx = <T>(work: (tx: DbTx) => Promise<T>) =>
  db.$transaction(work);
