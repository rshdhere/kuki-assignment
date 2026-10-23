#!/usr/bin/env bash
# Creates the S3 bucket and SQS queues KuKi needs in your own AWS account, then
# writes their names into apps/server/.env and apps/worker/.env.
#
#   bash scripts/setup-aws.sh                 # region from AWS_REGION, default ap-south-1
#   AWS_REGION=us-east-1 bash scripts/setup-aws.sh
#
# Needs the AWS CLI with credentials (`aws configure`) allowed to create S3
# buckets and SQS queues. Safe to rerun: existing resources are reused.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
region="${AWS_REGION:-ap-south-1}"
origin="${CLIENT_ORIGIN:-http://localhost:3000}"

command -v aws >/dev/null || {
  echo "The AWS CLI is not installed: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html" >&2
  exit 1
}
account="$(aws sts get-caller-identity --query Account --output text)" || {
  echo "AWS credentials aren't set up. Run \`aws configure\` first." >&2
  exit 1
}

# Bucket names are global, so the account id keeps this one unique.
bucket="kuki-documents-${account}-${region}"
queue="kuki-document-extraction"
dlq="${queue}-dlq"

echo "Account ${account}, region ${region}"

# --- S3: private bucket the browser uploads into with presigned PUTs ---------
if aws s3api head-bucket --bucket "$bucket" 2>/dev/null; then
  echo "✓ Bucket ${bucket} exists"
else
  if [ "$region" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$bucket" --region "$region" >/dev/null
  else
    aws s3api create-bucket --bucket "$bucket" --region "$region" \
      --create-bucket-configuration "LocationConstraint=${region}" >/dev/null
  fi
  echo "✓ Created bucket ${bucket}"
fi
aws s3api put-public-access-block --bucket "$bucket" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
# Without CORS the browser's preflight gets a 403 and every upload fails.
aws s3api put-bucket-cors --bucket "$bucket" --cors-configuration "{
  \"CORSRules\": [{
    \"AllowedOrigins\": [\"${origin}\"],
    \"AllowedMethods\": [\"PUT\"],
    \"AllowedHeaders\": [\"content-type\", \"x-amz-meta-filename\", \"x-amz-meta-sha256\"],
    \"ExposeHeaders\": [\"ETag\"],
    \"MaxAgeSeconds\": 3000
  }]
}"
echo "✓ Blocked public access and allowed uploads from ${origin}"

# --- SQS: the job queue, and a dead-letter queue for jobs that keep failing --
dlq_url="$(aws sqs create-queue --region "$region" --queue-name "$dlq" \
  --attributes MessageRetentionPeriod=1209600,SqsManagedSseEnabled=true \
  --query QueueUrl --output text)"
dlq_arn="$(aws sqs get-queue-attributes --region "$region" --queue-url "$dlq_url" \
  --attribute-names QueueArn --query Attributes.QueueArn --output text)"
# 5-minute visibility outlasts a slow extraction; 10 receives before the DLQ
# matches config.extraction.maxReceives in packages/config.
attributes="$(mktemp)"
trap 'rm -f "$attributes"' EXIT
cat >"$attributes" <<JSON
{
  "VisibilityTimeout": "300",
  "ReceiveMessageWaitTimeSeconds": "20",
  "SqsManagedSseEnabled": "true",
  "RedrivePolicy": "{\"deadLetterTargetArn\":\"${dlq_arn}\",\"maxReceiveCount\":\"10\"}"
}
JSON
queue_url="$(aws sqs create-queue --region "$region" --queue-name "$queue" \
  --attributes "file://${attributes}" --query QueueUrl --output text)"
echo "✓ Queue ${queue} (retries 10 times, then moves to ${dlq})"

# --- Point the server and worker at them -------------------------------------
set_var() { # file, name, value: replace the line if present, else append it
  local file="$1" name="$2" value="$3"
  if grep -q "^${name}=" "$file"; then
    sed -i.bak "s|^${name}=.*|${name}=${value}|" "$file" && rm -f "$file.bak"
  else
    printf '%s=%s\n' "$name" "$value" >>"$file"
  fi
}
for app in server worker; do
  env_file="$repo_root/apps/$app/.env"
  [ -f "$env_file" ] || cp "$repo_root/apps/$app/.env.example" "$env_file"
  set_var "$env_file" AWS_REGION "$region"
  set_var "$env_file" AWS_S3_BUCKET "$bucket"
  set_var "$env_file" AWS_SQS_QUEUE_URL "$queue_url"
done
ai_env="$repo_root/apps/ai/.env"
[ -f "$ai_env" ] || cp "$repo_root/apps/ai/.env.example" "$ai_env"
set_var "$ai_env" AWS_REGION "$region"
echo "✓ Wrote the bucket and queue into apps/server/.env and apps/worker/.env"
