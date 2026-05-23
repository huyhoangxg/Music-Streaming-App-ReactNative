import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { env } from './env';

const globalForPrisma = globalThis as typeof globalThis & {
  __prisma?: PrismaClient;
  __prismaPool?: Pool;
  __prismaAdapter?: PrismaPg;
};

const pool =
  globalForPrisma.__prismaPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
  });

const adapter = globalForPrisma.__prismaAdapter ?? new PrismaPg(pool as any);
const prisma = globalForPrisma.__prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prismaPool = pool;
  globalForPrisma.__prismaAdapter = adapter;
  globalForPrisma.__prisma = prisma;
}

export default prisma;
