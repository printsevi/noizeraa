# When to Mock

Mock at **system boundaries** only:

- External APIs (Brevo, Stripe)
- Time/randomness (panel `order_seed` generation, token expiry checks)
- Databases — prefer a real test database (Testcontainers Postgres) over mocking Drizzle; the query builder's whole value is real SQL against a real engine

Don't mock:

- Your own modules (`identity`, `catalog`, `media`, `sharing`, `panels`, `listeners`, `responses`, `results`, `billing`, `editorial`, `admin`)
- Internal collaborators within a module (a domain service calling a repository you also own)
- Anything you control

## Designing for mockability

At system boundaries, design interfaces that are easy to mock.

**1. Use dependency injection.** Pass external dependencies in (Nest's DI container does this naturally) rather than constructing them internally:

```typescript
// Easy to mock
class InvitationService {
  constructor(private readonly emailClient: BrevoClient) {}
  send(invitation: PanelInvitation) {
    return this.emailClient.sendTransactional(invitation.toEmailPayload());
  }
}

// Hard to mock
class InvitationService {
  send(invitation: PanelInvitation) {
    const client = new BrevoClient(process.env.BREVO_KEY);
    return client.sendTransactional(invitation.toEmailPayload());
  }
}
```

**2. Prefer SDK-style interfaces over generic fetchers.** Specific functions per external operation, not one generic client with conditional logic:

```typescript
// GOOD: each function is independently mockable
const stripe = {
  createCheckoutSession: (params) => stripeClient.checkout.sessions.create(params),
  syncSubscription: (id) => stripeClient.subscriptions.retrieve(id),
};

// BAD: mocking requires conditional logic inside the mock
const stripe = {
  call: (method, params) => stripeClient.request(method, params),
};
```

The SDK approach means each mock returns one specific shape, there's no conditional logic in test setup, it's easy to see which external calls a test exercises, and types stay per-endpoint.

## The outbox is not a mocking problem

Domain writes and their RabbitMQ events commit in one Postgres transaction via the outbox (tech proposal §9). Testing a use case that emits an event means asserting the `outbox_messages` row exists with the right `type`/`payload` after the transaction — not mocking `channel.publish()`, which the application code never calls directly anyway. The relay that actually publishes to RabbitMQ is a separate, boundary-level concern to test on its own, against a real broker (Testcontainers RabbitMQ), not from inside a domain-level test.
