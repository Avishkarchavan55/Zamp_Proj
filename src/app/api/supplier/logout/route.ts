import { cookies } from "next/headers";
import { SUPPLIER_COOKIE } from "@/lib/supplier-session";

export async function POST() {
  (await cookies()).delete(SUPPLIER_COOKIE);
  return Response.json({ ok: true });
}
