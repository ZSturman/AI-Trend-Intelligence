# AI Trend Intelligence MVP

A single-user web app and email digest that monitors the AI ecosystem, infers what a developer is actively working on, and ranks updates by personal relevance plus broader importance.

## What this MVP does

- Monitors a curated registry of AI sources:
  - official vendor/news feeds
  - GitHub releases
  - research feeds
  - selected video feeds
- Imports lightweight developer telemetry from:
  - GitHub
  - WakaTime
  - ActivityWatch summary imports
- Builds a profile of active languages, frameworks, tools, repos, editors, and AI interests
- Scores items with a deterministic ranking formula:
  - `0.35 personal relevance`
  - `0.30 ecosystem importance`
  - `0.20 actionability`
  - `0.15 freshness`
  - multiplied by a trust factor
- Delivers results through:
  - a ranked web experience
  - stored digest history
  - real email digests and alerts via Resend when configured

## Product shape

The information architecture maps to four sections:

- `Act Now`
- `Matched to Your Work`
- `Worth Evaluating`
- `Keep on Radar`

Each recommendation includes:

- source and recency
- score
- why it was shown
- why it matters
- save/dismiss feedback

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- Prisma + SQLite
- Resend for email
- Optional OpenAI-powered digest intro generation

## Setup

1. Install dependencies:

```bash
npm install
```

2. Initialize the local SQLite database:

```bash
npm run db:setup
```

3. Start the app:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Environment

Copy `.env.example` to `.env` and update as needed.

Important values:

- `DATABASE_URL`
- `DEFAULT_USER_EMAIL`
- `GITHUB_USERNAME`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `CRON_SECRET`

## Runtime behavior

### Manual flows in the app

- Save onboarding settings
- Run a sync
- Send a digest
- Send urgent alerts
- Import an ActivityWatch summary JSON payload

### Scheduled use

`GET /api/sync?secret=...`

Use this for cron-driven refreshes. The route will:

- ingest content
- sync telemetry
- rebuild the profile snapshot
- rerank recommendations

## Integrations

### GitHub

Expected inputs:

- GitHub username
- optional GitHub token
- optional watched repos list in `owner/repo` format

Signals inferred from:

- recent repos
- repo languages
- repo topics
- common manifests such as `package.json`, `pyproject.toml`, `requirements.txt`, `Cargo.toml`, `go.mod`, and `pom.xml`

### WakaTime

Expected input:

- API key

Signals inferred from:

- languages
- editors
- projects
- categories

### ActivityWatch

Expected input:

- pasted or uploaded aggregated JSON

Example payload:

```json
{
  "languages": [{ "name": "TypeScript", "hours": 7.5 }],
  "editors": [{ "name": "VS Code", "hours": 6.8 }],
  "projects": [{ "name": "agent-dashboard", "hours": 4.2 }]
}
```

This MVP intentionally stores derived summaries rather than raw local window history.

## Source model

The seed source registry covers:

- OpenAI
- Anthropic
- Google AI
- Hugging Face
- The Gradient
- Latent Space
- arXiv `cs.AI`
- selected YouTube feeds
- GitHub releases for core developer-facing AI repos

If live ingestion yields nothing, the app seeds a few clearly non-production demo items so the ranking UI remains testable.

## Privacy posture

- Single-user, read-only connector model
- Manual tokens instead of full OAuth for the MVP
- ActivityWatch uses summary import, not raw surveillance
- Recommendations expose why they surfaced
- Derived profile signals are stored; invasive raw telemetry is not the default

## Notes

- `npm run build` is the verification command used for this implementation
- Prisma’s direct `db push` flow was unreliable in this environment, so `npm run db:setup` creates the SQLite database from the schema diff using `sqlite3`
