# Backend Modules

Each module owns its HTTP routes, controllers, business services, and Zod
schemas. Routes are aggregated in `src/routes.ts` and mounted at `/api` by
`src/app.ts`.
