/**
 * PocketBase JS Hooks — Stripe Checkout Integration
 *
 * Placed in pb_hooks/ for automatic execution by PocketBase runtime.
 * Handles secure server-side price calculation and Stripe Checkout session creation.
 */

routerAdd("POST", "/api/create-checkout-session", (c) => {
  const stripeSecretKey = $os.getenv("STRIPE_SECRET_KEY") || "";
  const siteUrl = $os.getenv("SITE_URL") || "http://localhost:3000";

  let body = {};
  try {
    body = $apis.requestInfo(c).data;
  } catch (err) {
    return c.json(400, { error: "Invalid JSON payload" });
  }

  const items = body.items || [];
  if (!Array.isArray(items) || items.length === 0) {
    return c.json(400, { error: "Items array is required and cannot be empty" });
  }

  // 1. Fetch real products from PocketBase DB to prevent client price tampering
  const lineItems = [];
  let calculatedSubtotal = 0;

  for (const item of items) {
    const { productId, volume, qty } = item;
    const quantity = Math.max(1, parseInt(qty || 1, 10));

    if (!['50', '100'].includes(String(volume))) {
      return c.json(400, { error: `Invalid volume ${volume} for product ${productId}` });
    }

    let record = null;
    try {
      record = $app.dao().findFirstRecordByData("products", "slug", productId);
    } catch (_) {
      try {
        record = $app.dao().findRecordById("products", productId);
      } catch (_) {}
    }

    if (!record) {
      return c.json(404, { error: `Product not found: ${productId}` });
    }

    const priceField = volume === '100' ? 'price_100' : 'price_50';
    const unitPriceEur = Number(record.get(priceField)) || 0;
    const unitAmountCents = Math.round(unitPriceEur * 100);

    calculatedSubtotal += unitPriceEur * quantity;

    lineItems.push({
      price_data: {
        currency: "eur",
        product_data: {
          name: `${record.get("name")} (${volume}ml)`,
          description: record.get("desc") || undefined,
        },
        unit_amount: unitAmountCents,
      },
      quantity: quantity,
    });
  }

  // 2. Shipping logic: Free shipping over €150, else €15
  const shippingFeeEur = calculatedSubtotal >= 150 ? 0 : 15;
  if (shippingFeeEur > 0) {
    lineItems.push({
      price_data: {
        currency: "eur",
        product_data: {
          name: "Complimentary Delivery (under €150)",
        },
        unit_amount: Math.round(shippingFeeEur * 100),
      },
      quantity: 1,
    });
  }

  // 3. Mock mode fallback if Stripe API Key is not configured in environment
  if (!stripeSecretKey || stripeSecretKey.startsWith("mock_")) {
    const mockSessionId = "cs_test_" + $security.randomString(24);
    return c.json(200, {
      mock: true,
      sessionId: mockSessionId,
      checkoutUrl: `${siteUrl}/?order_status=success&session_id=${mockSessionId}`,
      total: calculatedSubtotal + shippingFeeEur,
      currency: "EUR"
    });
  }

  // 4. Create Stripe Checkout Session via Stripe REST API
  try {
    const formParams = [];
    formParams.push("payment_method_types[]=card");
    formParams.push("mode=payment");
    formParams.push(`success_url=${encodeURIComponent(siteUrl + '/?order_status=success&session_id={CHECKOUT_SESSION_ID}')}`);
    formParams.push(`cancel_url=${encodeURIComponent(siteUrl + '/?order_status=cancelled')}`);

    lineItems.forEach((li, idx) => {
      formParams.push(`line_items[${idx}][price_data][currency]=${li.price_data.currency}`);
      formParams.push(`line_items[${idx}][price_data][unit_amount]=${li.price_data.unit_amount}`);
      formParams.push(`line_items[${idx}][price_data][product_data][name]=${encodeURIComponent(li.price_data.product_data.name)}`);
      formParams.push(`line_items[${idx}][quantity]=${li.quantity}`);
    });

    const res = $http.send({
      url: "https://api.stripe.com/v1/checkout/sessions",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formParams.join("&"),
      timeout: 15,
    });

    if (res.statusCode >= 400) {
      return c.json(res.statusCode, { error: "Stripe error", details: res.json });
    }

    const session = res.json;
    return c.json(200, {
      sessionId: session.id,
      checkoutUrl: session.url,
      total: calculatedSubtotal + shippingFeeEur,
      currency: "EUR"
    });
  } catch (err) {
    return c.json(500, { error: "Failed to initiate Stripe session", details: String(err) });
  }
});

routerAdd("POST", "/api/stripe-webhook", (c) => {
  let event = {};
  try {
    event = $apis.requestInfo(c).data;
  } catch (err) {
    return c.json(400, { error: "Invalid webhook payload" });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data && event.data.object ? event.data.object : {};
    try {
      const ordersCollection = $app.dao().findCollectionByNameOrId("orders");
      const record = new Record(ordersCollection);

      record.set("stripe_session_id", session.id || "unknown");
      record.set("customer_email", session.customer_details ? session.customer_details.email : "");
      record.set("total", (session.amount_total || 0) / 100);
      record.set("currency", (session.currency || "eur").toUpperCase());
      record.set("status", "paid");
      record.set("items", session.metadata ? JSON.parse(session.metadata.items || "[]") : []);

      $app.dao().saveRecord(record);
      return c.json(200, { received: true, orderId: record.id });
    } catch (err) {
      return c.json(500, { error: "Failed to save order record", details: String(err) });
    }
  }

  return c.json(200, { received: true });
});
