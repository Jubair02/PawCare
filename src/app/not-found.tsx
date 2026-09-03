import Link from "next/link";
import { PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";

/** 404 for any path other than the single-route SPA at `/`. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-lg">
        <PawPrint className="size-8" />
      </div>
      <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-primary">404</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">This page ran off</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        We couldn&apos;t find the page you were looking for. It may have moved, or the link
        might be out of date.
      </p>
      <Button asChild className="mt-6 min-h-11">
        <Link href="/">Back to PawCare</Link>
      </Button>
    </div>
  );
}
