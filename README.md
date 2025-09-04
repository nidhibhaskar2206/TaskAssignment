# 📌 Task Assignment System

## 📖 Overview
The **Task Assignment System** is a backend-only project built with **Express.js**, **PostgreSQL**, and **Prisma ORM**.  
It enables **Super Admins** to create workspaces and assign workspace admins, who can then create roles with specific permissions and assign them to users.  
The system provides CRUD operations for tickets, role management, role assignments, and comments on tickets, along with read operations for history tracking.  

---

## 📂 Project Structure
You can view the full folder structure here:  
## 📂 Project Structure
 
```bash

server

├── config

│   ├── db.js                   # Database configuration

│   └── redis.js                # Redis configuration

│

├── controllers                 # Controllers handle request/response

│   ├── authController.js

│   ├── commentController.js

│   ├── ticketController.js

│   └── workspaceController.js

│

├── middlewares                 # Authentication & Authorization middlewares

│   ├── authenticate.js

│   ├── authorize.js

│   ├── loadUserRoleInWorkspace.js

│   └── workspaceContext.js

│

├── prisma                      # Prisma ORM setup

│   ├── migrations/

│   ├── schema.prisma

│   └── seed.js

│

├── queues                      # Job Queues

│   └── emailQueue.js

│

├── routes                      # API Routes

│   ├── authRoutes.js

│   ├── commentRoutes.js

│   ├── ticketRoutes.js

│   └── workspaceRoutes.js

│

├── services                    # Business logic services

│   └── emailService.js

│

├── utils                       # Utility functions

│   └── otpGenerator.js

│

├── workers                     # Background workers

│   └── emailWorker.js

│

├── .env                        # Environment variables

├── .gitignore

├── package-lock.json

├── package.json

└── server.js                   # Entry point
 ```

---

## ✨ Features
- **Workspace Management**
  - Super Admin can create workspaces and assign admins.
- **Role & Permission System**
  - Admins can define roles with specific permissions.
  - Roles can be assigned to different users.
- **Ticket Management**
  - CRUD operations for ticket creation and management.
  - Commenting system on tickets.
- **User & Role Management**
  - CRUD operations on users and roles.
  - Assign roles with specific permissions.
- **History Tracking**
  - View history logs (read-only).
- **Secure and Scalable**
  - Built with Prisma ORM and PostgreSQL for reliable data handling.

---

## 🛠 Tech Stack
- **Backend:** Express.js (TypeScript)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Code Quality:** ESLint
- **Build Tool:** Vite (for dev setup)

---

## 🚀 Development Setup

### 1️⃣ Setup Local Database with Prisma
```bash
# Install dependencies
npm install @prisma/client express
npm install prisma --save-dev

# Initialize Prisma
npx prisma init

# Run migrations
npx prisma migrate dev

# Open Prisma Studio (to explore DB visually)
npx prisma studio
```
### 2️⃣ Run the Project
```bash
# Install project dependencies
npm install

# Start the development server
npm run dev
```
## 🤝 Contributing

Contributions are welcome! To contribute:  

1. **Fork** the repository  
2. **Create a new feature branch**  
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Submit a Pull request**
