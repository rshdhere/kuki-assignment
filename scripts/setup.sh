#!/usr/bin/env bash
# One-time local setup. Safe to rerun: it never overwrites an existing .env.
#
#   OPENAI_API_KEY=sk-... bun run setup
#
# Installs dependencies, creates the .env files, starts Postgres and migrates
# it, and (when the AWS CLI is configured) creates your S3 bucket and SQS queues.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

step() { printf '\n\033[1m%s\033[0m\n' "$1"; }
need() { # command, install hint
  command -v "$1" >/dev/null || { echo "✗ $1 is missing. Install it: $2" >&2; missing=1; }
}

step "1/5 Checking tools"
missing=0
need bun "curl -fsSL https://bun.sh/install | bash"
need uv "curl -LsSf https://astral.sh/uv/install.sh | sh"
need docker "https://docs.docker.com/get-docker/"
need node "https://nodejs.org (version 24 or newer)"
[ "$missing" = 0 ] || exit 1
docker info >/dev/null 2>&1 || { echo "✗ Docker is installed but not running. Start Docker and rerun." >&2; exit 1; }
echo "✓ bun, uv, docker and node are ready"

step "2/5 Installing dependencies"
bun install
(cd apps/ai && uv sync)

step "3/5 Creating .env files"
for app in server worker ai; do
  if [ -f "apps/$app/.env" ]; then
    echo "✓ apps/$app/.env exists, left as is"
  else
    cp "apps/$app/.env.example" "apps/$app/.env"
    echo "✓ Created apps/$app/.env"
  fi
done
[ -f apps/client/.env.local ] || cp apps/client/.env.example apps/client/.env.local
if [ -n "${OPENAI_API_KEY:-}" ]; then
  sed -i.bak "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=${OPENAI_API_KEY}|" apps/ai/.env && rm -f apps/ai/.env.bak
  echo "✓ Saved OPENAI_API_KEY to apps/ai/.env"
elif ! grep -q '^OPENAI_API_KEY=.\+' apps/ai/.env; then
  echo "! No OpenAI key yet: add OPENAI_API_KEY to apps/ai/.env (or rerun with it set)"
fi

step "4/5 AWS: S3 bucket and SQS queues"
if grep -q '<account-id>' apps/server/.env; then
  if command -v aws >/dev/null && aws sts get-caller-identity >/dev/null 2>&1; then
    bash scripts/setup-aws.sh
  else
    echo "! Skipped: the AWS CLI isn't configured. Run \`aws configure\`, then \`bun run setup:aws\`."
  fi
else
  echo "✓ apps/server/.env already points at a queue"
fi

step "5/5 Postgres"
bun run db:up
bun run db:seed

if [ -f kuki-assignment-dataset.zip ] && [ ! -f "data/documents/quality_policy_nestle.pdf" ]; then
  unzip -oq kuki-assignment-dataset.zip -d data/documents
  echo "✓ Unpacked the assignment documents into data/documents/ (used by the evals)"
fi

step "Done. Start everything with:"
echo "  bun run dev"
echo "Then open http://localhost:3000 and upload the documents."
