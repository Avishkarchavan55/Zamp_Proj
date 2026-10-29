import { getStats } from "@/lib/repo";

export async function GET() {
  return Response.json(await getStats());
}
