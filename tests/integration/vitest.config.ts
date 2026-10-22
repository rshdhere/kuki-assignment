import { defineConfig } from "vitest/config";

// Created and migrated by the global setup if missing (see @kuki/drizzle/seed).
// Set here so the global setup (same process) can read it too.
process.env.TEST_DATABASE_URL ??=
  "postgres://kuki:kuki@localhost:5432/kuki_test";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Needs the compose.yaml Postgres: kuki_test is created and migrated once here, and every
    // test starts from empty tables.
    globalSetup: ["src/setup/global.ts"],
    setupFiles: ["src/setup/each.ts"],
    // Test files share one database, so run them one at a time.
    fileParallelism: false,
    // AWS calls are mocked with aws-sdk-client-mock. These fake values only
    // let the SDK sign requests, and they override any real AWS_* in the shell.
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      AWS_REGION: "ap-south-1",
      AWS_ACCESS_KEY_ID: "AKIATESTTESTTEST",
      AWS_SECRET_ACCESS_KEY: "test-secret",
      AWS_SESSION_TOKEN: "",
      AWS_PROFILE: "",
      AWS_S3_BUCKET: "kuki-test-bucket",
      AWS_SQS_QUEUE_URL:
        "https://sqs.ap-south-1.amazonaws.com/000000000000/kuki-test-queue",
    },
  },
});
