# SpaceShare — project notes for Claude

A marketplace where warehouse owners rent out spare space to small businesses.
Design doc: "Shared Warehouse Marketplace — MVP Design" (Claude Docs).

## Commits
- **Do NOT add `Co-Authored-By` trailers or any Claude attribution line to commit messages.** Commits are authored by Baselkhanfer11 only.
- Keep commit messages short and clear.

## Stack
- Backend: ASP.NET Core Web API (.NET 9, C#) + EF Core + SQL Server.
- Frontend: React 19 + Vite + TypeScript. Use **Bun** (`bun install`, `bun run dev`) — never npm.

## Workflow
- Every feature: new branch → pull request → merge into `main`.
- Run `git add .` from the repo **root**, not from `backend/` or `frontend/`.
- The user runs git commands themselves in the VS 2022 Developer PowerShell; explain each step.

## Rules that matter
- **Multi-tenant.** Every tenant-owned record has an `OrganizationId`, and EF Core global query filters
  keep one organisation from ever seeing another's data. New tenant-owned entities must implement
  `ITenantOwned` and get covered by the isolation tests.
- **No secrets in git.** The JWT key and the seeded admin password live in `dotnet user-secrets`.
- Ports: API on `http://localhost:5030`, Vite on `http://localhost:5173` (proxies `/api`).
