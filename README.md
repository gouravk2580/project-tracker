# 🚀 ProTrack – Project Management Web App

A full-stack project management tool where users can create projects, assign tasks, and track progress with role-based access (Admin/Member). Built with Node.js, Express, SQLite, and vanilla JavaScript.

## 🔗 Live Demo
[🔗 Click here to open live app](https://project-tracker.up.railway.app)  
*(Replace with your actual Railway URL if different)*

## ✨ Features
- 🔐 **User Authentication** – Signup/Login with JWT and password hashing
- 👥 **Role-Based Access** – Admin & Member roles
- 📁 **Project Management** – Create, update, delete projects
- 👨‍👩‍👧‍👦 **Team Management** – Add/remove members to projects (Admin only)
- ✅ **Task Management** – Create tasks, assign to members, set due dates, change status (todo, in‑progress, done)
- ⚠️ **Overdue Detection** – Tasks past their due date are highlighted
- 📊 **Dashboard** – Real-time stats (projects count, completed tasks, overdue)
- 🎨 **Modern UI** – Gradient sidebar, hover effects, modals, fully responsive

## 🛠 Tech Stack
| Layer       | Technology               |
|-------------|--------------------------|
| Backend     | Node.js, Express.js      |
| Database    | SQLite (better-sqlite3)  |
| Auth        | JWT, bcryptjs            |
| Frontend    | HTML5, CSS3, JavaScript  |
| Deployment  | Railway (with persistent volume) |

## 📦 Installation & Local Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/gouravk2580/project-tracker.git
   cd project-tracker
