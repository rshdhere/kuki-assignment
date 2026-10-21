# S3

`@kuki/s3`: [Amazon S3](https://aws.amazon.com/s3/) client for file storage.

## AWS resources

Buckets live in **Asia Pacific (Mumbai) `ap-south-1`**, one per environment.

| Environment | Bucket                                    |
| ----------- | ----------------------------------------- |
| Dev         | `kuki-evidence-documents-dev-ap-south-1`  |
| Prod        | `kuki-evidence-documents-prod-ap-south-1` |

Split objects by prefix inside a bucket (e.g. `uploads/`, `extracted/`) rather than creating more buckets.

![S3 console showing the dev and prod buckets in ap-south-1](docs/buckets.png)

## Usage

```ts
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "@kuki/s3";

await s3.send(
  new PutObjectCommand({
    Bucket: "kuki-evidence-documents-dev-ap-south-1",
    Key: "file.pdf",
    Body: buffer,
  }),
);
```

## Files

- `src/client.ts`: the shared `S3Client` instance
- `src/index.ts`: public exports

Put S3 helpers (uploads, presigned URLs, etc.) in their own files under `src/` and re-export them from `src/index.ts`.

## Environment

| Variable     | Description                   |
| ------------ | ----------------------------- |
| `AWS_REGION` | Region the client connects to |

Credentials come from the default AWS provider chain: `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` env vars, a shared profile, or an IAM role.

## Scripts

```sh
bun run lint         # ESLint
bun run check-types  # tsc --noEmit
```
