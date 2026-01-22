import Link from "next/link";
import { APP_NAME } from "../lib/appConfig";

export default function Home() {
  return (
    <main
      style={{
        padding: 40,
        maxWidth: 720,
        margin: "0 auto",
        fontFamily: "system-ui",
      }}
    >
      <h1 style={{ fontSize: 48, marginBottom: 8 }}>{APP_NAME}</h1>

      <p style={{ fontSize: 18, opacity: 0.85, marginBottom: 24 }}>
        Validate your idea in 60 seconds using structured AI analysis.
      </p>

      <ul style={{ lineHeight: 1.8, marginBottom: 28 }}>
        <li>Reality-check your idea before you build it.</li>
        <li>Uncover risks you haven’t considered</li>
        <li>Get a clear build / don’t-build verdict</li>
      </ul>

      <Link
        href="/login"
        style={{
          display: "inline-block",
          padding: "12px 18px",
          borderRadius: 10,
          background: "black",
          color: "white",
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        Login / Sign up
      </Link>
    </main>
  );
}
