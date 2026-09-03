"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for errors thrown in the root layout itself. It replaces
 * the whole document, so it cannot rely on app styles or shared components.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[pawcare:global]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          padding: "24px",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          background: "#fbfdfc",
          color: "#0f291f",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            display: "grid",
            placeItems: "center",
            fontSize: 30,
            background: "linear-gradient(135deg, #059669, #14b8a6)",
          }}
        >
          🐾
        </div>
        <h1 style={{ margin: "8px 0 0", fontSize: 22 }}>PawCare could not start</h1>
        <p style={{ margin: 0, maxWidth: 420, fontSize: 14, color: "#4b6358" }}>
          A critical error stopped the application from loading.
        </p>
        {error.digest ? (
          <p style={{ margin: 0, fontSize: 12, fontFamily: "ui-monospace, monospace", color: "#4b6358" }}>
            Reference: {error.digest}
          </p>
        ) : null}
        <button
          onClick={reset}
          style={{
            marginTop: 8,
            minHeight: 44,
            padding: "0 20px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            background: "#059669",
            color: "white",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
