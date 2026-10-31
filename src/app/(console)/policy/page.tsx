import { redirect } from "next/navigation";

/** The rules page is now "How to use" (old links keep working). */
export default function PolicyRedirect() {
  redirect("/how-to-use");
}
