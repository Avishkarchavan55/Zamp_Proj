import "server-only";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema";

/**
 * Thin query layer over two drivers:
 *  - DATABASE_URL set  -> postgres-js (Supabase / any Postgres; used in production)
 *  - otherwise         -> PGlite, an embedded Postgres persisted to .data/ (zero-setup local dev)
 * Both speak the same SQL, so the rest of the app only sees `query()`.
 */

type Row = Record<string, unknown>;
interface Driver {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  exec(text: string): Promise<void>;
}

async function createDriver(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    // prepare:false keeps us compatible with Supabase's transaction pooler (port 6543).
    const sql = postgres(url, {
      prepare: false,
      max: 5,
      idle_timeout: 20,
      // Our queries pass JSON already stringified (`$1::jsonb`); don't stringify it a second time.
      types: {
        json: {
          to: 114,
          from: [114, 3802],
          serialize: (x: unknown) => (typeof x === "string" ? x : JSON.stringify(x)),
          parse: (x: string) => JSON.parse(x),
        },
      },
    });
    return {
      async query<T>(text: string, params: unknown[] = []) {
        return (await sql.unsafe(text, params as never[])) as unknown as T[];
      },
      async exec(text: string) {
        await sql.unsafe(text);
      },
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir);
  await db.waitReady;
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await db.query<T>(text, params)).rows;
    },
    async exec(text: string) {
      await db.exec(text);
    },
  };
}

const globalForDb = globalThis as unknown as { __vendoriqDb?: Promise<Driver> };

async function init(): Promise<Driver> {
  const driver = await createDriver();
  await driver.exec(SCHEMA_SQL);
  await seedGstRegistry(driver);
  return driver;
}

async function seedGstRegistry(driver: Driver) {
  const file = path.join(process.cwd(), "fixtures", "gst_registry.json");
  if (!fs.existsSync(file)) return;
  const records = JSON.parse(fs.readFileSync(file, "utf8")) as Array<Record<string, string>>;
  // Top up when the sandbox file gained vendors since the table was first filled.
  const [{ n }] = await driver.query<{ n: number }>("select count(*)::int as n from gst_registry");
  if (n >= records.length) return;
  for (const r of records) {
    await driver.query(
      `insert into gst_registry (gstin, legal_name, trade_name, status, state_code, constitution)
       values ($1,$2,$3,$4,$5,$6) on conflict (gstin) do nothing`,
      [r.gstin, r.legal_name, r.trade_name, r.status, r.state_code, r.constitution],
    );
  }
}

function getDb(): Promise<Driver> {
  if (!globalForDb.__vendoriqDb) {
    globalForDb.__vendoriqDb = init().catch((err) => {
      globalForDb.__vendoriqDb = undefined;
      throw err;
    });
  }
  return globalForDb.__vendoriqDb;
}

export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  return db.query<T>(text, params);
}

export async function one<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export const json = (value: unknown) => JSON.stringify(value ?? null);
