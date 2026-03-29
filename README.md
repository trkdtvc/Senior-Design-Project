# Senior Design Project
Your Friendly Neighborhood Chatster (YFNC) is a Discord-inspired chat app I’m building for my senior design project. The idea is to create a platform where users can join servers, chat in channels, manage roles and permissions, and eventually use an integrated AI assistant inside the app.

## Project Overview
This project is meant to bring together the main parts of a full-stack web application in one place. It includes authentication, server and channel management, messaging, backend documentation, testing, email support, and later deployment. The main goal is to build something practical that feels like a real-world communication platform rather than just a basic school project.

## Main Features
- User registration and login with JWT authentication
- Server creation and management
- Channel organization
- Text-based messaging
- Role-based permissions
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
At this stage, the backend foundation is already in place. That includes the main backend entities, the routes/controllers/models structure, JWT authentication, centralized error handling, Swagger documentation, and the first round of integration tests.

The current test setup already covers:
- a public route
- a protected auth route without a token
- a protected server route without a token
- an unknown route returning a 404 response

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
