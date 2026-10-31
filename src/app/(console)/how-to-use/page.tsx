import { redirect } from "next/navigation";

/** The page is now "Info" (old links keep working). */
export default function HowToUseRedirect() {
  redirect("/info");
}
