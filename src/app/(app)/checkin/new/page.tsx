import { redirect } from "next/navigation";

/** The check-in lives on Today now; old links and reminders sent before that land there. */
export default function NewCheckInPage() {
  redirect("/today#checkin");
}
