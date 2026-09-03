"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PawPrint, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary. Without this an uncaught render error left the
 * user on a blank screen in production.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[pawcare]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-lg">
        <PawPrint className="size-8" />
      </div>
      <h1 className="mt-5 text-2xl font-bold tracking-tight">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        An unexpected error interrupted this page. Your data is safe — trying again usually
        clears it.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button onClick={reset} className="min-h-11">
          <RefreshCw className="size-4" />
          Try again
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
