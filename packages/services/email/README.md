# Email

`@kuki/email`: transactional email via [Resend](https://resend.com).

## Usage

```ts
import { getResend } from "@kuki/email";

await getResend().emails.send({
  from: "KuKi <noreply@example.com>",
  to: "user@example.com",
  subject: "Hello",
  html: "<p>Hi there</p>",
});
```

`getResend()` creates the client on first use, so importing this package doesn't require the API key.

## Files

- `src/resend.ts`: lazily created `Resend` client
- `src/index.ts`: public exports

## Environment

| Variable         | Description    |
| ---------------- | -------------- |
| `RESEND_API_KEY` | Resend API key |

## Scripts

```sh
bun run lint         # ESLint
bun run check-types  # tsc --noEmit
```
