import { APP_NAME } from "../../lib/appConfig";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  return (
    <main style={{ padding: "40px" }}>
      <h1>✅ Payment successful</h1>

      <p>Thank you for subscribing to {APP_NAME}.</p>

      <p>
        <strong>Session ID:</strong> {session_id ?? "Missing session_id"}
      </p>

      <a href="/">Go back home</a>
    </main>
  );
}
