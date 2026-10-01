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

### Run the backend
```bash
cd backend/SpaceShare.Api
dotnet run
```
The API listens on `http://localhost:5030`.

### Run the frontend
```bash
cd frontend
bun install
bun run dev
```
Open `http://localhost:5173`. Vite forwards every `/api` request to the backend.

## MVP milestones
- [ ] 1. Foundation — organisations, users, roles, tenant isolation, sign-up and approval
- [ ] 2. Listings and search
- [ ] 3. Booking
- [ ] 4. Receiving and stock
- [ ] 5. Outbound requests
- [ ] 6. Billing
- [ ] 7. Pilot polish
