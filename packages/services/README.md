# Services

Clients for third-party services, one package per service.

| Folder    | Package       | Service                                           |
| --------- | ------------- | ------------------------------------------------- |
| `aws/S3`  | `@kuki/s3`    | Amazon S3: file storage                           |
| `aws/SQS` | `@kuki/sqs`   | Amazon SQS: message queues                        |
| `email`   | `@kuki/email` | [Resend](https://resend.com): transactional email |

Each service has its own `package.json`, so it only pulls in its own SDK.

## Adding a service

1. Create a folder (under `aws/` for AWS services)
2. Copy `package.json`, `tsconfig.json` and `eslint.config.js` from an existing service and rename the package
3. Make sure the folder matches a `workspaces` glob in the root `package.json` (`packages/services/*` or `packages/services/aws/*`)
4. Add any env vars it reads to the `dev` and `test` tasks in `turbo.json`
