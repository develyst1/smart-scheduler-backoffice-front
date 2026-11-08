"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getClaims } from "@/lib/auth";
import { homeFor } from "@/lib/roles/pages";

// The app root only sends a signed-in person to their role's home (proxy.ts already sent a signed-out one to /login).
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const user = getClaims();
    router.replace(user ? homeFor(user.role) : "/login");
  }, [router]);
  return null;
}
