"use client";

export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
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
          gap: 16,
          fontFamily:
            '"Schibsted Grotesk", Arial, Helvetica, sans-serif',
          background: "#edf2f3",
          color: "#14303a",
          textAlign: "center",
          padding: "0 24px",
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          Something went wrong
        </h1>
        <p style={{ color: "#5b7480", maxWidth: 360, margin: 0 }}>
          An unexpected error occurred while loading Nightshift.
        </p>
        <button
          onClick={() => retry()}
          style={{
            background: "#14303a",
            color: "#edf2f3",
            border: 0,
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
