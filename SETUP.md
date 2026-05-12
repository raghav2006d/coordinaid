# Installation and Setup Guide

## Prerequisites

- Node.js 16+ and npm
- MongoDB (local) or Docker
- Git (optional)

## Quick Start

### 1. Go to project root
```bash
cd "sepm project"
```

### 2. Start MongoDB

Option A: Local MongoDB
- Ensure MongoDB is running on `mongodb://localhost:27017`

Option B: Docker
```bash
docker-compose up -d
```

MongoDB runs on `mongodb://localhost:27017`

### 3. Backend setup
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend runs on `http://localhost:5000`

Optional: backfill adaptive learning metrics from existing data
```bash
cd backend
npm run backfill
```

### 4. Frontend setup
```bash
cd ../frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

## Environment Variables

Backend `.env`:
```
MONGODB_URI=mongodb://localhost:27017/volunteer-system
JWT_SECRET=your_secret_key_here
PORT=5000
NODE_ENV=development
```

## Key API Endpoints

Authentication:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password/:token`

Events and roles:
- `GET /api/events`
- `POST /api/events`
- `POST /api/events/:id/roles`

Assignments:
- `POST /api/assignments/run`
- `GET /api/assignments`
- `PUT /api/assignments/:id/status`
- `GET /api/assignments/:id/recommendations`
- `GET /api/assignments/event/:eventId/recommendations`
- `POST /api/assignments/manual`
- `POST /api/assignments/:id/reassign-next`
- `POST /api/assignments/event/:eventId/confirm`
- `GET /api/assignments/event/:eventId/export-pdf`

Attendance:
- `POST /api/attendance/mark`
- `POST /api/attendance/bulk-mark`
- `POST /api/attendance/proof-upload`
- `POST /api/attendance/proof`
- `PUT /api/attendance/:id/verify`
- `GET /api/attendance/leaderboard/top`
- `GET /api/attendance/leaderboard/export`
- `GET /api/attendance/leaderboard/export-pdf`

Leaderboard:
- `GET /api/leaderboard`

## AI Allocation and Learning

Base scoring:
```
Base Score = (Skill Match x 0.5) +
             (Experience x 0.2) +
             (Availability x 0.2) +
             (Performance x 0.1)
```

Learning boost:
```
Learning Boost = (Acceptance Rate x 0.2) +
                 (Attendance Rate x 0.2) +
                 (Role Preference x 0.2)
```

Final Score = Base Score + Learning Boost

Learning updates happen after accept/decline and attendance verification.

## Troubleshooting

MongoDB connection issues:
- Verify MongoDB is running on port 27017
- Check `MONGODB_URI` in `.env`

Port already in use:
- Change `PORT` in backend `.env`
- Update frontend `.env` if needed

## Build for Production

Backend:
```bash
cd backend
npm install
# set NODE_ENV=production
```

Frontend:
```bash
cd frontend
npm run build
```

## Notes

- No automated test suite is configured yet.
- Learning improves as more assignments and attendance records accumulate.
