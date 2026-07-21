"use server";

import { signOut } from "@/auth";

export async function logout(locale: string): Promise<void> {
  await signOut({ redirectTo: `/${locale}` });
}
