# Smart Event Volunteer Allocation System - Project Summary

## Overview

This project is a full-stack system for managing college event volunteers with AI-driven allocation, adaptive learning, and role-based workflows. It covers volunteer onboarding, skills and availability, event and role creation, automated allocation, attendance verification, notifications, and analytics.

## What Was Built

- Role-based dashboards for Volunteers, Organizers, and Admins
- AI allocation that scores volunteers by skills, experience, availability, and performance
- Adaptive learning to improve future allocations based on acceptance, attendance, and role success
- Attendance proof upload with organizer verification
- Real-time in-app notifications and automatic reallocation on declines
- Leaderboard and analytics with CSV/PDF export
- Admin user management and system monitoring

## Backend Structure

Models:
- `User` with skills, availability, performance, learning signals, and role preference maps
- `Event`, `Role`, `Assignment`, `Attendance`

Controllers:
- Auth, users, events, assignments, attendance, leaderboard, notifications

Utilities:
- Allocation scoring, recommendation service, learning service, notification helpers

## Frontend Structure

Pages:
- Landing, Login, Register
- Volunteer, Organizer, Admin dashboards
- Create Event, Allocation Studio, Assignments, Attendance, Analytics (Leaderboard)

Components:
- Sidebar, Header, Card, ProgressBar

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

Learning updates:
- On accept/decline: update acceptance rate and decline patterns
- On attendance verification: update attendance rate and role preference

## Key APIs Added

- `GET /api/leaderboard`
- `GET /api/assignments/event/:eventId/recommendations`
- `POST /api/assignments/manual`
- `POST /api/assignments/event/:eventId/confirm`
- `GET /api/assignments/event/:eventId/export-pdf`
- `POST /api/attendance/proof-upload`
- `POST /api/attendance/proof`
- `PUT /api/attendance/:id/verify`
- `GET /api/attendance/leaderboard/export`
- `GET /api/attendance/leaderboard/export-pdf`

## Deployment Notes

- Backend: Node.js + Express
- Frontend: React + Vite
- Database: MongoDB (local or Atlas)
- Docker Compose for local DB

## Current Status

The system is feature-complete for the requested workflows and ready for testing or deployment. No automated test suite is configured yet.
