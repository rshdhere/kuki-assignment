#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
# Vercel uses the Dockerfile's directory as its context, regardless of daemon root.
cp "$repo_root/docker/Dockerfile.worker" "$repo_root/Dockerfile.worker"
