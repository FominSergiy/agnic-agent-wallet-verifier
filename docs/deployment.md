# Deployment runbook

One-time provisioning steps + ongoing operations for backend (Deno Deploy) and frontend (Cloudflare Pages). CI is fully automated via [.github/workflows/ci.yml](../.github/workflows/ci.yml) — only the dashboard wiring below is manual.

## Topology

```
GitHub: FominSergiy/agnic-agent-wallet-verifier
│
├── PR / push to main → GitHub Actions CI (deno fmt/lint/check/test + web typecheck/build)
│
├── push to main → Deno Deploy   → https://<project>.deno.dev   (API, standalone)
└── push to main → Cloudflare Pages → https://<project>.pages.dev (web UI → calls API)
```

Both platforms also build preview deployments for every PR. The Actions workflow runs in parallel; configure it as a required merge check in the repo's branch-protection settings so failing CI blocks merges.

## 1. Backend — Deno Deploy (one-time)

1. Sign in at https://dash.deno.com and click **New Project → Deploy from GitHub**.
2. Authorize the Deno Deploy GitHub app on `FominSergiy/agnic-agent-wallet-verifier`.
3. Project settings:
   - **Production branch:** `main`
   - **Entry point:** `src/main.ts`
   - **Install / build step:** leave empty (Deno fetches deps at runtime).
4. Add environment variables (Project → Settings → Environment Variables):

   | Key | Value | Notes |
   |-----|-------|-------|
   | `AGNIC_API_KEY` | `agnic_tok_…` | **Required.** From your local `.env`. |
   | `AI_MODEL` | e.g. `anthropic/claude-sonnet-4.6` | Optional override. |
   | `SYNTHESIS_MODEL` | e.g. `anthropic/claude-opus-4.7` | Optional override. |
   | `AGNIC_BUDGET_MIN_USD` | e.g. `0.10` | Optional pre-flight floor. |
   | `ALLOWED_ORIGIN` | `*` initially, then the Pages URL after step 2 | CORS. |

   `DENO_DEPLOYMENT_ID` is set automatically by the platform — the health store reads it to switch to in-memory mode. No action needed.

5. First deploy fires on push. Record the production URL: `https://<project>.deno.dev`.
6. Smoke:
   ```bash
   curl https://<project>.deno.dev/health
   # → {"status":"ok"}

   curl -X POST https://<project>.deno.dev/discover \
     -H 'Content-Type: application/json' \
     -d '{"address":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","chain":"eth"}'
   ```

## 2. Frontend — Cloudflare Pages (one-time)

1. Sign in at https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git**.
2. Authorize Cloudflare on `FominSergiy/agnic-agent-wallet-verifier`.
3. Build settings:
   - **Production branch:** `main`
   - **Framework preset:** None
   - **Root directory (advanced):** `web`
   - **Build command:** `npm ci && npm run build`
   - **Build output directory:** `dist`
4. Environment variables (set for both **Production** and **Preview**):

   | Key | Value |
   |-----|-------|
   | `VITE_API_BASE_URL` | `https://<project>.deno.dev` (from step 1) |

5. Trigger first deploy. Record the production URL: `https://<project>.pages.dev`.
6. Back to **Deno Deploy** → set `ALLOWED_ORIGIN=https://<project>.pages.dev` (replace the `*` from step 1.4).
7. Smoke: open the Pages URL, submit a wallet address, confirm the verify stream renders and the network panel shows requests hitting the Deno Deploy origin with `200`s and no CORS errors.

## 3. Branch protection (one-time)

Repo Settings → **Branches → Add rule** for `main`:

- ☑︎ Require status checks to pass before merging
  - ☑︎ `Backend (Deno)` (from `ci.yml`)
  - ☑︎ `Frontend (Vite + React)` (from `ci.yml`)
- ☑︎ Require branches to be up to date before merging

## Ongoing operations

- **Day-to-day:** open a PR → both platforms post preview URLs as PR comments. Merge to `main` → both auto-deploy in ~30–60s.
- **Rollback:** Deno Deploy → Project → Deployments → click any prior deployment → **Promote to production**. Cloudflare Pages → Deployments → **Rollback**.
- **Secret rotation:** rotate `AGNIC_API_KEY` in the Deno Deploy dashboard; the next deploy picks it up. No code change.
- **Logs:** Deno Deploy → Project → Logs. Cloudflare Pages → Deployment → View build / Functions logs.

## Future: MCP HTTP endpoint

When the `feat/mcp-server` branch lands its HTTP transport, it will mount on the same Hono app at `POST /mcp` (+ `GET /mcp` for SSE) — so Claude Desktop / Claude Code can point at `https://<project>.deno.dev/mcp` for live demos. No second deployment is required; the SSE smoke test (`/verify-agent-stream`) already proves the streaming path works on Deno Deploy. The MCP PR will also need to extend `allowHeaders` in [src/main.ts](../src/main.ts) with `Mcp-Session-Id` and `Mcp-Protocol-Version`.
