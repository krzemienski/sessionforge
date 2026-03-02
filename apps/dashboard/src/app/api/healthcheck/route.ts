import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  let dbOk = false;

  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch {
    // db unreachable
  }

  const status = dbOk ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      db: dbOk,
      redis: false,
      timestamp: new Date().toISOString(),
    },
    { status: dbOk ? 200 : 503 }
  );
}
