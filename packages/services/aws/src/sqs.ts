import { SQSClient } from "@aws-sdk/client-sqs";

// Credentials come from the default AWS provider chain (env vars, profile, IAM role).
export const sqs = new SQSClient({ region: process.env.AWS_REGION });
