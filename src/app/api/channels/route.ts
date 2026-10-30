import { channels } from "@/lib/channels";
import { appUrl } from "@/lib/http";

/** Public: the ways a vendor can apply (portal link, onboarding inbox, Google Form). */
export async function GET(req: Request) {
  return Response.json(channels(appUrl(req)));
}
