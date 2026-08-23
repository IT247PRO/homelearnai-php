# HomeLearnAI v2 (React + Node.js + SQLite)

This directory is a from-scratch rewrite of the HomeLearnAI Laravel/HTMX/PostgreSQL
application living at the repository root. The original app is left untouched for
reference during the migration.

## Stack

- **client/** — React 18 + TypeScript + Vite + Tailwind CSS + TanStack Query
- **server/** — Node.js + Express + TypeScript REST API
- **database/** — Prisma schema, migrations, and seeds targeting SQLite (WAL mode)

## Getting started

```bash
cd src-v2
npm install

cp database/.env.example database/.env
cp server/.env.example server/.env

npm run db:migrate   # creates database/prisma/dev.db and applies schema
npm run db:seed      # loads default PreK-12 subjects/units

npm run dev           # runs client (5173) + server (3001) together
```

## Workspace layout

```
src-v2/
├── client/     React SPA (Parent Dashboard + Kids Mode)
├── server/     Express API (auth, curriculum, flashcards, spaced repetition, ICS import)
├── database/   Prisma schema + migrations + seed scripts (SQLite)
└── package.json
```

## Status

This is an active migration. See the project's task tracker / commit history for
current coverage of ported features (curriculum CRUD, flashcard review engine,
scheduling, ICS import, Kids Mode PIN gating).
