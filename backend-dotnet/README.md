# backend-dotnet

ASP.NET Core (.NET 8) Web API that mirrors the existing Python backend endpoints.

- Auth: JWT bearer
- MongoDB: MongoDB.Driver
- PDF: QuestPDF

Run via Docker Compose alongside the existing backend for safe migration.
ASP.NET Core backend for Malatya Avize Dünyası.

Goals
- Mirror the existing FastAPI endpoints and JSON shapes
- MongoDB via MongoDB.Driver
- JWT auth compatible with frontend
- PDF generation (İrsaliye) via QuestPDF

Build & Run (Docker)
- Will be wired in docker-compose under service `backend-dotnet` listening on 8001.
