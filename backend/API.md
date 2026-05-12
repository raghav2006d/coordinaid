# Backend API - SmartVolunteer

## Overview

Complete REST API for Smart Event Volunteer Allocation System built with Node.js + Express + MongoDB.

## Features

- 🔐 JWT Authentication with Role-Based Access Control
- 🤖 AI-Powered Volunteer Allocation Algorithm
- 📊 Comprehensive Data Models
- ✅ Input Validation & Error Handling
- 🔗 RESTful Endpoints

## Getting Started

### Install Dependencies
```bash
npm install
```

### Environment Setup
```bash
cp .env.example .env
# Edit .env with your configuration
```

### Run Development Server
```bash
npm run dev
```

Server runs on `http://localhost:5000`

### Health Check
```bash
curl http://localhost:5000/api/health
```

## API Endpoints

### Authentication

#### Register User
```
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "volunteer"
}

Response: 201 Created
{
  "message": "User registered successfully",
  "token": "eyJhbGc...",
  "user": { "id": "...", "name": "...", "email": "...", "role": "..." }
}
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}

Response: 200 OK
{
  "message": "Login successful",
  "token": "eyJhbGc...",
  "user": { "id": "...", "name": "...", "email": "...", "role": "..." }
}
```

#### Logout
```
POST /api/auth/logout
Authorization: Bearer {token}

Response: 200 OK
{
  "message": "Logout successful"
}
```

### Users

#### Get Profile
```
GET /api/users/profile
Authorization: Bearer {token}

Response: 200 OK
{
  "_id": "...",
  "name": "John Doe",
  "email": "john@example.com",
  "skills": [
    { "name": "Event Planning", "level": "intermediate" }
  ],
  "performanceScore": 85,
  "totalParticipations": 5
}
```

#### Update Profile
```
PUT /api/users/profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "John Updated",
  "skills": [
    { "name": "Leadership", "level": "advanced" }
  ]
}

Response: 200 OK
```

#### Add Skill
```
POST /api/users/skills
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Public Speaking",
  "level": "intermediate"
}

Response: 200 OK
```

#### Update Availability
```
PUT /api/users/availability
Authorization: Bearer {token}
Content-Type: application/json

{
  "availability": [
    {
      "date": "2026-04-15",
      "startTime": "09:00",
      "endTime": "17:00"
    }
  ]
}

Response: 200 OK
```

### Events

#### Create Event
```
POST /api/events
Authorization: Bearer {token}
Content-Type: application/json

{
  "eventName": "Annual Sports Day",
  "description": "College sports event",
  "date": "2026-05-20",
  "venue": "Sports Complex",
  "maxVolunteers": 50
}

Response: 201 Created
```

#### Get Events
```
GET /api/events?page=1&limit=20&status=planning
Authorization: Bearer {token}

Response: 200 OK
{
  "total": 5,
  "page": 1,
  "limit": 20,
  "events": [...]
}
```

#### Add Role to Event
```
POST /api/events/{eventId}/roles
Authorization: Bearer {token}
Content-Type: application/json

{
  "roleName": "Coordinator",
  "description": "Event coordinator",
  "requiredSkills": [
    { "name": "Leadership", "minimumLevel": "intermediate" }
  ],
  "requiredCount": 5
}

Response: 201 Created
```

### Assignments (AI Allocation)

#### Run AI Allocation
```
POST /api/assignments/run
Authorization: Bearer {token}
Content-Type: application/json

{
  "eventId": "507f1f77bcf86cd799439011"
}

Response: 200 OK
{
  "message": "Allocation completed",
  "totalAssignments": 15,
  "allocations": [...]
}
```

#### Get Assignments
```
GET /api/assignments?volunteerId={id}&status=pending&page=1
Authorization: Bearer {token}

Response: 200 OK
{
  "total": 10,
  "page": 1,
  "limit": 20,
  "assignments": [
    {
      "_id": "...",
      "volunteerId": {...},
      "eventId": {...},
      "roleId": {...},
      "matchScore": {
        "skillMatch": 85,
        "experienceMatch": 70,
        "availabilityMatch": 100,
        "performanceMatch": 80,
        "totalScore": 84
      },
      "status": "pending"
    }
  ]
}
```

#### Update Assignment Status
```
PUT /api/assignments/{assignmentId}/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "accepted"
}

Response: 200 OK
```

### Attendance

#### Mark Attendance
```
POST /api/attendance/mark
Authorization: Bearer {token}
Content-Type: application/json

{
  "volunteerId": "...",
  "eventId": "...",
  "assignmentId": "...",
  "status": "present"
}

Response: 201 Created
```

#### Bulk Mark Attendance
```
POST /api/attendance/bulk-mark
Authorization: Bearer {token}
Content-Type: application/json

{
  "attendanceData": [
    {
      "volunteerId": "...",
      "eventId": "...",
      "assignmentId": "...",
      "status": "present"
    }
  ]
}

Response: 201 Created
```

#### Get Attendance by Event
```
GET /api/attendance/event/{eventId}?page=1&limit=50
Authorization: Bearer {token}

Response: 200 OK
```

#### Get Leaderboard
```
GET /api/attendance/leaderboard/top?limit=10
Authorization: Bearer {token}

Response: 200 OK
[
  {
    "name": "Top Volunteer",
    "email": "top@example.com",
    "performanceScore": 95,
    "totalParticipations": 20,
    "skills": [...]
  }
]
```

## Data Models

### User
```javascript
{
  name: String (required),
  email: String (unique, required),
  password: String (required),
  role: 'volunteer' | 'organizer' | 'admin',
  skills: [{ name, level: 'beginner' | 'intermediate' | 'advanced' }],
  availability: [{ date, startTime, endTime }],
  participationHistory: [],
  performanceScore: Number (0-100),
  totalParticipations: Number
}
```

### Event
```javascript
{
  eventName: String,
  description: String,
  date: Date,
  venue: String,
  createdBy: ObjectId (ref: User),
  roles: [ObjectId] (ref: Role),
  status: 'planning' | 'allocation-in-progress' | 'allocated' | 'completed',
  maxVolunteers: Number
}
```

### Role
```javascript
{
  eventId: ObjectId (ref: Event),
  roleName: String,
  description: String,
  requiredSkills: [{ name, minimumLevel }],
  requiredCount: Number,
  assignedCount: Number
}
```

### Assignment
```javascript
{
  volunteerId: ObjectId (ref: User),
  eventId: ObjectId (ref: Event),
  roleId: ObjectId (ref: Role),
  matchScore: {
    skillMatch: Number,
    experienceMatch: Number,
    availabilityMatch: Number,
    performanceMatch: Number,
    totalScore: Number
  },
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'no-show'
}
```

## Error Handling

All errors returned in standard format:
```json
{
  "message": "Error description"
}
```

HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Server Error

## Authentication

All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer {token}
```

Tokens expire in 7 days.

## Database

Using MongoDB with Mongoose ORM.

### Connection String Format
```
mongodb://[username:password@]hostname[:port]/[database]
```

### Example
```
mongodb://localhost:27017/volunteer-system
mongodb+srv://user:password@cluster.mongodb.net/volunteer-system
```

## Performance

- Response time < 3 seconds
- Indexed database queries
- Optimized aggregation pipeline

## Security

- JWT token-based authentication
- Bcrypt password hashing
- CORS enabled
- Input validation
- Role-based access control

## Deployment

### Environment Variables (Production)
```
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/volunteer-system
JWT_SECRET=your_production_secret_key
PORT=5000
NODE_ENV=production
```

### Deploy to Render
1. Connect GitHub repository
2. Set environment variables
3. Deploy

### Deploy to Railway
1. Connect GitHub repository
2. Configure MongoDB Atlas
3. Deploy

---

**API Version**: 1.0
**Last Updated**: March 2026
