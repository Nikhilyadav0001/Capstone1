# 🔐 Login & Signup Platform

A modern, secure authentication application built with **Express.js**, **MongoDB**, and **Google OAuth**. Features Docker containerization and automated CI/CD with Jenkins.

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square)
![MongoDB](https://img.shields.io/badge/MongoDB-7-brightgreen?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-Ready-blue?style=flat-square)
![Jenkins](https://img.shields.io/badge/Jenkins-CI%2FCD-red?style=flat-square)
![License](https://img.shields.io/badge/License-ISC-yellow?style=flat-square)

</div>

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🚀 Quick Start](#-quick-start)
- [🐳 Docker Setup](#-docker-setup)
- [🔑 Google OAuth Configuration](#-google-oauth-configuration)
- [📁 Project Structure](#-project-structure)
- [⚙️ Environment Variables](#️-environment-variables)
- [🔧 Jenkins CI/CD](#-jenkins-cicd)
- [📊 Database](#-database)
- [📝 API Endpoints](#-api-endpoints)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ Features

- ✅ **Email & Password Authentication** — Secure signup and login
- ✅ **Google OAuth 2.0** — One-click social login
- ✅ **Session Management** — Secure sessions stored in MongoDB
- ✅ **Password Security** — Bcrypt hashing with salt rounds
- ✅ **Responsive UI** — Clean, modern interface with EJS templates
- ✅ **Docker Support** — Complete containerization with Docker Compose
- ✅ **Automated CI/CD** — Jenkins pipeline for build, test, and deployment
- ✅ **Health Check** — Built-in health check endpoint (`/health`)

---

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+** — [Download here](https://nodejs.org/)
- **MongoDB** — [Install locally](https://www.mongodb.com/try/download/community) or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- **Git** — [Download here](https://git-scm.com/)

### Installation Steps

```bash
# 1. Clone or navigate to the project
cd loginpage/loginpage

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env

# 4. Configure your environment variables in .env
#    - Set MONGODB_URI (default: mongodb://localhost:27017/loginpage)
#    - Set SESSION_SECRET (any random string)
#    - (Optional) Add Google OAuth credentials

# 5. Start the application
npm start

# 6. Open in your browser
#    http://localhost:3000
```

### Verify Installation

- Login page should be visible at `http://localhost:3000`
- MongoDB should be running and accessible
- Console should show: `Server running on port 3000`

---

## 🐳 Docker Setup

Run the entire application stack (app + MongoDB) with Docker Compose:

```bash
# Build and start containers
docker-compose up -d --build

# View logs
docker-compose logs -f app

# Stop containers
docker-compose down

# Remove containers and volumes
docker-compose down -v
```

**Access the application:** `http://localhost:3000`

> **Note:** Docker Compose automatically starts MongoDB and configures the connection string.

---

## 🔑 Google OAuth Configuration

To enable Google OAuth login, follow these steps:

### 1. Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a **new project** (or select an existing one)
3. Navigate to **APIs & Services → Credentials**
4. Click **+ Create Credentials** → **OAuth 2.0 Client ID**
5. Choose **Web application**
6. Add **Authorized redirect URIs:**
   - `http://localhost:3000/auth/google/callback` (local)
   - Your production URL (if applicable)

### 2. Add Credentials to .env

```env
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

### 3. Test

- Refresh the app
- Click the "Login with Google" button
- You should be redirected to Google's login page

> **Optional:** The app functions perfectly without Google OAuth. The button will simply redirect back if credentials aren't configured.

---

## 📊 Database

### MongoDB Collections

This application uses the following MongoDB collections:

| Collection | Purpose |
|-----------|---------|
| **users** | Stores user accounts with email, hashed passwords, and profile info |
| **sessions** | Manages user sessions for authenticated requests |

### Viewing Data

**Using MongoDB Compass:**

1. Open MongoDB Compass
2. Connect to: `mongodb://localhost:27017/loginpage`
3. Browse collections and documents

**Alternative:** Install [MongoDB DatabaseTools](https://www.mongodb.com/try/download/database-tools) for command-line access

---

## 🔧 Jenkins CI/CD

The `Jenkinsfile` defines an automated pipeline for building, testing, and deploying the application.

### Pipeline Stages

| Stage | Description |
|-------|-------------|
| **Checkout** | Pulls the latest code from your Git repository |
| **Install Dependencies** | Runs `npm ci` to install dependencies |
| **Run Tests** | Executes test suite with `npm test` |
| **Build Docker Image** | Builds the Docker image for the application |
| **Deploy** | Starts the application with `docker-compose up` |
| **Health Check** | Verifies the app is running and healthy |

### Setting Up Jenkins

1. **Install Jenkins** with the following plugins:
   - Pipeline
   - GitHub (or GitLab/Bitbucket as needed)
   - Docker plugin
   - Node.js plugin

2. **Create a Pipeline Job:**
   - New Item → Pipeline
   - Configure → Pipeline → Pipeline script from SCM
   - SCM: Git
   - Repository URL: Your Git repository
   - Script Path: `Jenkinsfile`

3. **Configure Node.js in Jenkins:**
   - Manage Jenkins → Global Tool Configuration
   - Add Node.js 18+
   - Name: `nodejs`

4. **Trigger the Pipeline:**
   - Push to your Git repository
   - Jenkins automatically detects and runs the pipeline

---

## 📝 API Endpoints

### Authentication Routes

| Method | Endpoint | Description |
|--------|---------|-------------|
| `GET` | `/` | Home page |
| `GET` | `/login` | Login page |
| `GET` | `/signup` | Sign up page |
| `POST` | `/auth/register` | Register new user |
| `POST` | `/auth/login` | Authenticate user |
| `GET` | `/auth/google` | Initiate Google OAuth |
| `GET` | `/auth/google/callback` | Google OAuth callback |
| `GET` | `/logout` | Logout user |
| `GET` | `/dashboard` | User dashboard (protected) |
| `GET` | `/health` | Health check endpoint |

### Other Routes

- **AI Chat:** `/ai/*`
- **Travel Planning:** `/travel/*`
- **Places Discovery:** `/places/*`

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork the repository**
2. **Create a branch:** `git checkout -b feature/your-feature-name`
3. **Make changes** and test locally
4. **Commit with a clear message:** `git commit -m "Add feature: description"`
5. **Push to your branch:** `git push origin feature/your-feature-name`
6. **Create a Pull Request**

### Development Tips

- Run `npm test` before committing
- Follow the existing code style
- Update the README if you add new features
- Test both locally and with Docker

---

## 🐛 Troubleshooting

### Common Issues

**Port 3000 already in use:**
```bash
# Change the PORT environment variable
PORT=3001 npm start
```

**MongoDB connection failed:**
```bash
# Check MongoDB is running
mongod

# Or use MongoDB Atlas (cloud)
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/loginpage npm start
```

**Google OAuth not working:**
- Verify credentials are set in `.env`
- Check redirect URI matches exactly in Google Cloud Console
- Clear browser cookies and restart the app

**Docker build fails:**
```bash
# Clean up and rebuild
docker-compose down -v
docker-compose up -d --build
```

**Tests failing:**
```bash
# Ensure MongoDB is running
npm test
```

---

## 📁 Project Structure

```
loginpage/
├── 📄 app.js                          # Express application entry point
├── 📦 package.json                    # Project dependencies and scripts
├── 🐳 Dockerfile                      # Docker image definition
├── 🐳 docker-compose.yml              # Docker Compose configuration
├── 🔄 Jenkinsfile                     # Jenkins CI/CD pipeline
├── 📝 README.md                       # This file
│
├── 🔐 config/
│   └── passport.js                    # Passport authentication strategies
│
├── 🗄️ models/
│   ├── User.js                        # User database schema
│   ├── Trip.js                        # Trip bookings schema
│   ├── Itinerary.js                   # Itinerary planning schema
│   └── Bookmark.js                    # Bookmarks schema
│
├── 🛣️ routes/
│   ├── auth.js                        # Authentication routes (login, signup)
│   ├── ai.js                          # AI chat/recommendation routes
│   ├── places.js                      # Place discovery routes
│   └── travel.js                      # Travel planning routes
│
├── 🔌 services/
│   ├── aiService.js                   # AI service integration
│   ├── photoService.js                # Photo/image service
│   ├── weatherService.js              # Weather API integration
│   └── stateService.js                # State management service
│
└── 🎨 views/
    ├── home.ejs                       # Home/landing page
    ├── login.ejs                      # Login page
    ├── signup.ejs                     # Sign up page
    ├── dashboard.ejs                  # User dashboard
    ├── ai-chat.ejs                    # AI chat interface
    ├── explore.ejs                    # Explore destinations
    ├── trip-detail.ejs                # Trip details page
    ├── trip-new.ejs                   # Create new trip
    └── partials/
        ├── header.ejs                 # Header partial
        └── footer.ejs                 # Footer partial
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory with the following variables:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3000` | ❌ |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/loginpage` | ✅ |
| `SESSION_SECRET` | Session encryption key | N/A | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | N/A | ❌ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | N/A | ❌ |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback URL | `http://localhost:3000/auth/google/callback` | ❌ |
| `NODE_ENV` | Environment (development/production) | `development` | ❌ |

**Example `.env` file:**

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/loginpage
SESSION_SECRET=your-super-secret-key-here-change-in-production
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
NODE_ENV=development
```

---

## 📄 License

This project is licensed under the **ISC License** — feel free to use it in your personal or commercial projects.

---

## 📞 Support & Questions

- 📧 Create an issue on GitHub for bugs or features
- 💬 Check existing issues for common problems
- 📚 Review the code comments for implementation details
- 🔗 Refer to [Express.js](https://expressjs.com/) and [MongoDB](https://docs.mongodb.com/) documentation

---

## hi this is to show the pipeline
<div align="center">




[⬆ Back to Top](#-login--signup-platform)

</div>