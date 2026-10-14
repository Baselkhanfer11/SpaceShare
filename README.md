# SpaceShare

A marketplace for warehouse space. Warehouse owners list the space they aren't using; small businesses,
online sellers and seasonal traders rent exactly what they need — by the pallet, shelf or square metre,
for weeks instead of years. Once goods are stored, the business tracks its stock live and asks the
warehouse to ship, return or prepare a pickup, all in the app.

> 🚧 MVP in progress.

## Tech stack

| Layer | Technology |
|-------|------------|
| Backend | ASP.NET Core Web API (.NET 9, C#) |
| Frontend | React 19 + Vite + TypeScript |
| Database | SQL Server + Entity Framework Core |
| Package manager (frontend) | Bun 🐰 |

## Project structure

```
SpaceShare/
├── backend/
│   ├── SpaceShare.sln
│   └── SpaceShare.Api/      # The Web API (serves JSON under /api)
└── frontend/                # React app (calls the API over HTTP)
```

## Getting started

### Prerequisites
- [.NET SDK 9](https://dotnet.microsoft.com/download)
- [Bun](https://bun.sh)
- SQL Server

### One-time setup: secrets
Secrets never go in git. Locally they live in `dotnet user-secrets` (stored in your user profile,
outside the repo). Inside `backend/SpaceShare.Api`:
```bash
dotnet user-secrets set "Jwt:Key" "<a long random string, at least 32 characters>"
dotnet user-secrets set "Seed:AdminPassword" "<the platform admin's password>"
```
The first run creates the platform admin (`admin@spaceshare.local`, set in `appsettings.json`) with that
password. After that you can remove `Seed:AdminPassword`.

### Optional: demo data
To try the app with example companies and listings already in it, choose a password for the demo accounts:
```bash
dotnet user-secrets set "Seed:DemoPassword" "<a password for all demo accounts>"
```
The next `dotnet run` (Development only) adds them once. Every demo account signs in with that password;
if you change it, the accounts switch to the new one the next time the API starts.

| Account | Company | What it shows |
|---------|---------|---------------|
| `rami@demo.spaceshare.local` | Sahab Logistics Park (warehouse owner, Amman) | a live listing and a rejected one |
| `omar@demo.spaceshare.local` | Sahab Logistics Park (warehouse staff) | the staff view |
| `lina@demo.spaceshare.local` | Aqaba Gateway Storage (warehouse owner) | a live listing with chilled space |
| `sami@demo.spaceshare.local` | Zarqa Cold Chain (warehouse owner) | a live listing and one waiting for review |
| `nadia@demo.spaceshare.local` | Bayt Coffee Roasters (business, Amman) | searching for space |
| `yousef@demo.spaceshare.local` | Bayt Coffee Roasters (business member) | a team member |
| `khaled@demo.spaceshare.local` | Irbid Textile Co. (business) | searching for space |
| `hiba@demo.spaceshare.local`, `tariq@demo.spaceshare.local` | companies waiting for approval | the admin's review queue |

The demo photos come from `SpaceShare.Api/DemoData/photos`.

### Run the backend
```bash
cd backend/SpaceShare.Api
dotnet run
```
The API listens on `http://localhost:5030`. On startup it creates or updates the `SpaceShareDb`
database by itself (EF Core migrations).

### Run the tests
```bash
cd backend
dotnet test
```
They run the real API on a throwaway in-memory database. The tenant-isolation tests prove one
organisation can never see or change another's data.

### Run the frontend
```bash
cd frontend
bun install
bun run dev
```
Open `http://localhost:5173`. Vite forwards every `/api` request to the backend.

Signed-out visitors land on the 3D landing page (`src/pages/LandingPage.tsx`, scene in `src/landing/`,
built with three.js). Its warehouse, businesses and numbers are examples, not live data.

## MVP milestones
- [x] 1. Foundation — organisations, users, roles, tenant isolation, sign-up and approval
- [x] 2. Listings and search
- [ ] 3. Booking
- [ ] 4. Receiving and stock
- [ ] 5. Outbound requests
- [ ] 6. Billing
- [ ] 7. Pilot polish
