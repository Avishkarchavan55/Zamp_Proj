import { getStats } from "@/lib/repo";
import { tidyJson } from "@/lib/tidy";

export async function GET() {
  return Response.json(tidyJson(await getStats()));
}
