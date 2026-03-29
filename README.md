# Senior Design Project
Your Friendly Neighborhood Chatster (YFNC) is a Discord-style web chat platform built as a senior design project. It is focused on real-time text communication, room-based interaction, role-based organization, and AI assistant integration.

## Project Overview
The goal of this project is to build a modern web-based chat application for communities, teams, and student groups. The platform supports user authentication, server and channel organization, text messaging, role and permission management, backend API documentation, testing, email integration, and deployment.

## Main Features
- User registration and login with JWT authentication
- Server creation and management
- Channel organization
- Text-based messaging system
- Role-based access and permissions
- REST API backend
- Swagger / OpenAPI documentation
- Integration testing with Jest and Supertest
- Planned email integration
- Planned AI assistant integration
- Planned deployment

## Tech Stack
### Backend
- Node.js
- Express.js
- MySQL
- JWT Authentication
- Swagger / OpenAPI
- Jest
- Supertest

### Frontend
- HTML
- CSS
- JavaScript
- Bootstrap

## Current Project Status
The backend foundation has been completed, including:
- Core backend entities
- Routes, controllers, and models structure
- JWT-based authentication
- Centralized error handling
- Swagger documentation
- Initial integration testing setup with passing tests

Currently completed test coverage includes:
- Public route test
- Protected auth route without token
- Protected server route without token
- Unknown route / 404 middleware test

## Project Structure
```bash
Backend/
├── node_modules/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── app.js
│   └── server.js
├── tests/
├── .env
├── .gitignore
├── package.json
└── package-lock.json
