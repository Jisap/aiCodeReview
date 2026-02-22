"use client"

import { HealthCheck } from "@/components/health-check";
import { Button } from "@/components/ui/button";
import Link from "next/link";


export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <h1>Welcome to codereview</h1>
        <p>Start reviewing your code today!</p>
      </div>

      <div className="flex gap-4">
        <Button asChild>
          <Link href="/login">Login</Link>
        </Button>

        <Button asChild>
          <Link href="/register">Register</Link>
        </Button>
      </div>

      <HealthCheck />
    </div>
  );
}
