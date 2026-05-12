# SmartVolunteer - Detailed Project Documentation

## 1. Overview

SmartVolunteer is a full-stack platform that automates volunteer allocation for college events. It combines skill-based matching with adaptive learning, so recommendations improve as the system observes real volunteer behavior.

Primary goals:
- Reduce manual assignment effort for organizers
- Improve volunteer-role fit using skills and performance
- Provide transparent analytics for engagement and reliability

## 2. Roles and Responsibilities

Volunteer:
- Maintain skills and availability
- Accept/decline assignments
- Upload attendance proof
- Track performance and leaderboard

Organizer:
- Create events and roles
- Run AI allocation
- Review recommendations and assign directly
- Confirm allocations and export PDF
- Verify attendance proof

Admin:
- Manage users and system oversight
- Review system analytics

## 3. Core Features

### 3.1 Authentication and RBAC
- JWT-based authentication
- Role-based access control
- Password reset flow

### 3.2 Volunteer Profiles
- Skills with levels
- Availability calendar
- Performance metrics

### 3.3 Event and Role Management
- Create events with categories and max volunteer requirements
- Define multiple roles and required skills per event

### 3.4 AI Allocation
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

### 3.5 Adaptive Learning
Tracked per volunteer:
- acceptedAssignments / totalAssignments
- attendedEvents / assignedEvents
- rolePreferenceScores (map of role to success)
- declinePatterns (map of role to decline count)

Updates:
- On accept/decline: update acceptance rate and decline patterns
- On attendance verification: update attendance rate and role preference

### 3.6 Recommendation System
- Role-based suggestions per event
- Match percentage with reasons
- Reliability and role success indicators
- Organizer can assign directly

### 3.7 Attendance Proof and Verification
- Volunteers upload proof
- Organizers approve/reject
- Attendance updates feed learning and performance

### 3.8 Leaderboard and Analytics
Leaderboard formula:
```
Leaderboard Score =
(Participation x 35%) +
(Attendance x 25%) +
(Acceptance x 20%) +
(Performance x 15%) +
(Skill Diversity x 5%)
```

Exports:
- CSV/PDF for leaderboard and assignments

## 4. Data Models (Highlights)

User (volunteer fields):
- skills[], availability[]
- performanceScore, totalParticipations
- acceptanceRate, attendanceRate
- rolePreferenceScores, declinePatterns

Event:
- eventName, date, venue, category, status
- roles[]

Role:
- roleName, requiredSkills[], requiredCount, preferredExperienceLevel

Assignment:
- volunteerId, eventId, roleId
- matchScore breakdown
- status (pending, accepted, declined, completed, no-show)

Attendance:
- status, proofImage, verificationStatus
- verifiedBy, verifiedAt

## 5. Main API Endpoints

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

## 6. Local Setup

Backend:
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Optional: backfill adaptive learning metrics
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

## 7. Deployment

Backend:
- Render, Railway, Heroku, or AWS

Frontend:
- Vercel, Netlify, or S3

Database:
- MongoDB Atlas or local

## 8. Notes

- No automated tests are configured yet.
- The learning system improves as more assignments and attendance records accumulate.
- Organizers can override recommendations any time.
