import Stripe from "stripe";
import { APP_NAME } from "../../../lib/appConfig";

type Plan = "monthly" | "yearly";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { user_id?: string; plan?: Plan };
    const user_id = body?.user_id;
    const plan = body?.plan;

    if (!user_id) {
      return Response.json({ error: "Missing user_id" }, { status: 400 });
    }

    const selectedPlan: Plan = plan === "yearly" ? "yearly" : "monthly";

    const priceId =
      selectedPlan === "yearly"
        ? process.env.STRIPE_PRICE_ID_YEARLY
        : process.env.STRIPE_PRICE_ID_MONTHLY;

    if (!priceId) {
      return Response.json(
        {
          error:
            selectedPlan === "yearly"
              ? "Missing STRIPE_PRICE_ID_YEARLY in .env.local"
              : "Missing STRIPE_PRICE_ID_MONTHLY in .env.local",
        },
        { status: 500 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return Response.json(
        { error: "Missing NEXT_PUBLIC_APP_URL in .env.local" },
        { status: 500 }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-12-15.clover",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing`,

      metadata: {
        user_id,
        app: APP_NAME,
        plan: selectedPlan,
      },

      subscription_data: {
        // 30-day free trial ONLY for monthly plan
        ...(selectedPlan === "monthly" ? { trial_period_days: 30 } : {}),
        metadata: {
          user_id,
          app: APP_NAME,
          plan: selectedPlan,
        },
      },
    });

    return Response.json({ url: session.url });
  } catch (err: any) {
    return Response.json(
      { error: err?.message || "Checkout failed" },
      { status: 500 }
    );
  }
}
