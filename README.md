# Smart Event Volunteer Allocation System

A full-stack web app for colleges that automates volunteer assignment for events using skill-based AI matching, adaptive learning, and organizer-friendly workflows.

## Highlights

- AI allocation using skills, experience, availability, and performance
- Adaptive learning that improves recommendations over time
- Role-based dashboards (Volunteer, Organizer, Admin)
- In-app notifications and automatic reallocation on declines
- Attendance tracking with proof upload and organizer verification
- Leaderboard and analytics with CSV/PDF exports
- Admin user management and system insights

## Tech Stack

Frontend:
- React 18 + Vite
- Tailwind CSS
- Framer Motion
- Axios

Backend:
- Node.js + Express
- MongoDB + Mongoose
- JWT authentication
- bcrypt password hashing

## Project Structure

```
sepm project/
├── backend/
│   ├── models/
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   ├── utils/
│   └── server.js
├── frontend/
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── context/
│       └── utils/
├── docker-compose.yml
├── README.md
├── SETUP.md
└── PROJECT.md
```

## AI Allocation and Adaptive Learning

Base scoring (allocation):
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

The system updates acceptance, attendance, and role preference after volunteers accept/decline and after attendance is verified.

## Key Features by Role

Volunteer:
- Manage skills and availability
- Accept/decline assignments
- Submit attendance proof
- See leaderboard position and badges

Organizer:
- Create events and define roles
- Run AI allocation
- Confirm allocations and export PDF
- Reassign to next best volunteer
- View recommendations with reasons and reliability

Admin:
- Manage users
- Monitor activity and reports

## API Overview

Authentication:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password/:token`

Events:
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

## Quick Start

Backend:
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Optional: backfill adaptive learning metrics from existing data
```bash
cd backend
npm run backfill
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

Docker (MongoDB):
```bash
docker-compose up -d
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:5000/api`

## Documentation

- Setup: `SETUP.md`
- Project details: `PROJECT.md`
- API reference: `backend/API.md`

## License

Academic Project - 2026
