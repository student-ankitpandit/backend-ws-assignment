# Live Attendance System (Backend + Test Suite)

This workspace contains:
- an Express + WebSocket backend service
- an external black-box test suite used to validate behavior

## Workspace Structure

- `http/` - backend API and WebSocket server
- `mid-test/` - Vitest test suite for functional validation

## Tech Stack

Backend (`http/`):
- Runtime: Bun (project was initialized with Bun)
- Server: Express 5
- Realtime: express-ws
- Database: MongoDB via Mongoose
- Auth: JWT (`jsonwebtoken`)
- Validation: Zod

Tests (`mid-test/`):
- Test runner: Vitest
- WebSocket client: ws

## Backend Overview (`http/`)

Main files:
- `index.ts` - HTTP routes, WebSocket route, attendance session state
- `middleware.ts` - auth and teacher role middleware
- `model.ts` - Mongoose schemas/models
- `types.ts` - Zod request schemas
- `request.d.ts` - Express request augmentation (`userId`, `role`)

### Data Models

- `Users`
  - `name`, `email` (unique), `password`, `role` (`student` or `teacher`)
- `Classes`
  - `className`, `teacherId`, `studentIds[]`
- `Attendances`
  - `classId`, `studentId`, `status` (`present` or `absent`)

### HTTP Endpoints

Auth:
- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`

Class management:
- `POST /class`
- `POST /class/:id/add-student`
- `GET /class/:id`
- `GET /students`

Attendance HTTP:
- `POST /attendance/start`
- `GET /class/:id/my-attendance`

### WebSocket Endpoint

- `ws://<host>:<port>/ws?token=<jwt>`

Supported events:
- `ATTENDANCE_MARKED`
- `TODAY_SUMMARY`
- `MY_ATTENDANCE`
- `DONE`

Error event format:
- `event: "ERROR"`
- `data: { message: string }`

## Environment Variables

Set these before running the backend:
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - secret for signing/verifying JWT
- `PORT` (optional) - defaults to `3000`

## Docker Support

This repo now includes Docker support for both:
- backend service (`http/`)
- MongoDB service (default MongoDB port `27017`)

Added files:
- `docker-compose.yml`
- `http/Dockerfile`
- `http/.dockerignore`

### Run with Docker Compose

From workspace root:

```bash
docker compose up --build -d
```

This starts:
- backend on `http://localhost:3000`
- MongoDB on `mongodb://localhost:27017`

To stop:

```bash
docker compose down
```

To stop and remove MongoDB data volume:

```bash
docker compose down -v
```

## Run Backend

From `http/`:

```bash
bun install
bun run index.ts
```

Backend default URLs:
- HTTP: `http://localhost:3000`
- WebSocket: `ws://localhost:3000/ws`

## Run Tests

1. Start backend first (port `3000` unless overridden).
2. In another terminal, from `mid-test/`:

```bash
bun install
bun test
```

Optional environment overrides:

```bash
SERVER_URL=http://localhost:4000 WS_URL=ws://localhost:4000/ws bun test
```

### Run `mid-test` Against Dockerized Backend + MongoDB

1. Start containers from root:

```bash
docker compose up --build -d
```

2. Run tests from `mid-test/`:

```bash
bun install
bun test
```

3. If needed, force explicit URLs:

```bash
SERVER_URL=http://localhost:3000 WS_URL=ws://localhost:3000/ws bun test
```

Notes for `mid-test`:
- Tests assume backend HTTP on `3000`
- Tests assume WebSocket endpoint `/ws`
- MongoDB is expected to be available; with Docker compose it is provided on default port `27017`

## Response Conventions

HTTP success:

```json
{
  "success": true,
  "data": {}
}
```

HTTP error:

```json
{
  "success": false,
  "error": "message"
}
```

WebSocket message:

```json
{
  "event": "EVENT_NAME",
  "data": {}
}
```

## Note

- Attendance state is managed in-memory for active sessions.
