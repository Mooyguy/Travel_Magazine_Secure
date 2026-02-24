# Wanderlust Magazine Portal

This project is a static travel magazine front end with a Node.js + Express + SQLite backend for storing tour registrations and an admin login to review submissions.

## ✅ What’s included
- Visitor registration form (front end)
- Node.js + Express API
- SQLite storage
- Admin login with session-based authentication
- Admin dashboard (`admin.html`)

## ✅ Setup
1. Copy the environment file:
2. Install dependencies.
3. Start the server.

```bash
npm install
npm start
```

## ✅ API endpoints
- `POST /api/registrations` — store a new registration
- `POST /api/admin/login` — login
- `POST /api/admin/logout` — logout
- `GET /api/admin/me` — session check
- `GET /api/admin/registrations` — list registrations (admin only)

## Notes
- The SQLite database is used to store data
- This setup is for local demo usage.
