# Enterprise Audit Trail / Activity Tracking System

A centralized activity logging and auditing system designed to track user journeys, inspect API executions, and troubleshoot failures. 

This repository implements a working prototype consisting of a **.NET 10 Web API backend** structured in **Layered Architecture**, a **MongoDB database** for persistence (containing separate collections for logs, posts, resumes, assessments, questions, and user accounts), and an interactive **React + TypeScript frontend dashboard** utilizing cookie-based session verification.

---

## 🛠️ Layered Architecture Design

The backend is built around a standard layered API architecture, organized into top-level folders for easy navigation:

```
                  ┌──────────────────────────────────────────────┐
                  │                 CONTROLLERS                  │
                  │  (AuditController, PostController,           │
                  │   AuthController, ResumeController,          │
                  │   AssessmentController)                      │
                  └──────────────────────┬───────────────────────┘
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │                SUPERVISORS                   │
                  │  (AuditLoggingSupervisor, PostSupervisor,    │
                  │   ResumeSupervisor, AssessmentSupervisor)    │
                  └──────────────────────┬───────────────────────┘
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │                 REPOSITORIES                 │
                  │  (MongoDbContext, MongoAuditLogRepository,   │
                  │   MongoPostRepository, MongoResumeRepository,│
                  │   MongoAssessmentRepository)                 │
                  └──────────────────────┬───────────────────────┘
                                         ▼
                                  [( MongoDB )]
```

- **Controllers**: Exposes HTTP REST endpoints for dashboard queries, real-time posts, cookie session authentication, profile resumes, and skill assessments. Handlers delegate processing directly to their corresponding supervisor.
- **Supervisors**: Contains business rules, validations, database transaction boundaries, and orchestrates explicit business log writes.
- **Repositories**: Houses the database client connection and Bson-to-model repository mappings for CRUD operations.
- **Middleware**: Intercepts requests to inject correlation IDs and automatically log events or capture system crashes.
- **Models / DTOs**: Houses the core domain models (`AuditLog`, `Post`, `User`, `Resume`, `Question`, `Assessment`) and request structures.

---

## 📂 Project Structure

```
├── backend/Audit.Api/              # .NET 10 Web API Backend
│   ├── Controllers/                # REST Controller Endpoints (request/response validation)
│   │   ├── AuditController.cs
│   │   ├── PostController.cs       # Hub Posts Controller
│   │   ├── AuthController.cs       # Cookie Session Auth Controller
│   │   ├── ResumeController.cs     # Resume Profile Controller
│   │   └── AssessmentController.cs # Skill Assessment Controller
│   ├── Supervisors/                # Business workflows & Audit log orchestration
│   │   ├── IAuditLoggingSupervisor.cs / AuditLoggingSupervisor.cs
│   │   ├── IAuditLogQueriesSupervisor.cs / AuditLogQueriesSupervisor.cs
│   │   ├── IPostSupervisor.cs / PostSupervisor.cs
│   │   ├── IResumeSupervisor.cs / ResumeSupervisor.cs
│   │   └── IAssessmentSupervisor.cs / AssessmentSupervisor.cs
│   ├── Repositories/               # MongoDB driver context & repositories
│   │   ├── MongoDbContext.cs       # Seeds default database contents
│   │   ├── IAuditLogRepository.cs / MongoAuditLogRepository.cs
│   │   ├── IPostRepository.cs / MongoPostRepository.cs
│   │   ├── IResumeRepository.cs / MongoResumeRepository.cs
│   │   └── IAssessmentRepository.cs / MongoAssessmentRepository.cs
│   ├── Middleware/                 # Global Pipeline Interceptors
│   │   ├── CorrelationIdMiddleware.cs
│   │   └── AuditLoggingMiddleware.cs # Captures systemic transport-level API logs
│   ├── Configuration/              # DB AppSettings connection models
│   │   └── MongoDbSettings.cs
│   ├── Models/                     # Core Entity models (AuditLog, Post, User, Resume, Question, Assessment)
│   └── DTOs/                       # Simulated API payload models
│
└── frontend/                       # React + TypeScript Vite Frontend
    ├── src/
    │   ├── components/             # Sidebar, Dashboard Stats, Table, Filters, Timeline, Details Modal
    │   │   └── Sidebar.tsx         # Unified left navigation layout panel
    │   ├── pages/                  # Routed Pages (react-router-dom)
    │   │   ├── Login.tsx           # Authentication Portal Page (Route: '/login')
    │   │   ├── Dashboard.tsx       # Live Audit Analytics Page (Route: '/')
    │   │   ├── Hub.tsx             # Achnet Community Hub Feed Page (Route: '/hub')
    │   │   ├── ResumePage.tsx      # Achnet Profile Resume Builder (Route: '/resume')
    │   │   └── AssessmentPage.tsx  # Skill Assessment Quiz Board (Route: '/assessment')
    │   ├── App.tsx                 # Routing mapping bootstrap configuration
    │   └── types.ts                # Shared TypeScript types
    │   └── index.css               # Design system & dark tech styles
```
