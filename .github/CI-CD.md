# GitHub Actions CI/CD

`.github/workflows/ci-cd.yml` runs on pull requests, pushes to `main`, and manual
runs. It uses Node.js 24, Bun 1.2.3, Python 3.12, and frozen dependency locks.

The checks job runs lint, type checks, the production client build, Postgres-backed
integration tests, and Python unit tests. Integration test global setup creates
and migrates `kuki_test`; AWS calls use the existing test mocks. Tests are forced
to run rather than restored from Turborepo's cache. A separate job runs Chromium
Playwright tests and retains failure traces for seven days. No production secrets
are needed for these jobs, including pull requests from forks.

## Enable production deployments

The deploy job targets the existing root `vercel.json`. Finish and commit that
deployment configuration and its supporting files before enabling CD. Verify that
the linked Vercel project supports the configured services and worker daemon;
this pipeline does not provision infrastructure or apply production DB migrations.

1. Install the Vercel CLI locally with `npm i -g vercel`, then run `vercel link`
   from the repository root. Set up the project's production runtime variables
   (database, AWS, AI, and email settings) in Vercel.
2. Create the GitHub `production` environment. Add secrets `VERCEL_TOKEN`,
   `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` there. The IDs are available in the
   local `.vercel/project.json`; never commit that file or tokens.
3. Set repository variable `VERCEL_CLI_VERSION` to an exact stable CLI version
   tested with this project's deployment configuration (`vercel --version`).
4. Disable Vercel's automatic Git production deployments if Actions should own
   production releases, so pushes cannot deploy before these checks pass.
5. Set repository variable `VERCEL_DEPLOY_ENABLED` to `true`.

Successful checks on `main` then pull production settings, build using Vercel,
and deploy that build with `--prebuilt`. Production deployments are serialized
and are never canceled mid-deploy. A manual run on `main` also deploys when CD
is enabled; manual runs on other branches only run checks. Until enabled, CI
runs normally and the deploy job is skipped.

Require both `Lint, types, build and tests` and `Playwright` in the `main` branch
ruleset. Optional deployment approvals can be configured on the `production`
environment. To rerun a failed release, rerun its workflow or dispatch on `main`.

Deployment commands follow the [official Vercel GitHub Actions guide](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel).
