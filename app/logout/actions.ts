"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";

export async function logoutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
  await logActivity("logout", "Logout");
  redirect("/login");
}
