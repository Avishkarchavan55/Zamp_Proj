import { redirect } from "next/navigation";

/** The rules page is now "Info" (old links keep working). */
export default function PolicyRedirect() {
  redirect("/info");
}
