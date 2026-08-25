# Separate Express Backend Instead of Next.js API Routes

The application uses a standalone Express server as the API layer rather than Next.js API routes or Server Actions. Next.js handles UI and routing only; all data access goes through Express. This keeps the API independently deployable and independently testable, and it was the decided starting point for the project.
