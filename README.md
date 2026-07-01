# E-Libra 📚

Your digital reading universe — A modern web-based library management system for discovering and managing books online.

## Overview

E-Libra is a full-stack digital library platform that allows users to:

- **Browse & Discover** thousands of books in a digital library
- **Authenticate** securely with JWT-based authentication
- **Manage Books** with features for searching, filtering, and organizing
- **Access Anytime** via a responsive web interface

## Tech Stack

### Frontend

- **HTML5** - Semantic markup and structure
- **CSS3** - Modern styling with responsive design
- **Vanilla JavaScript** - Dynamic client-side interactions

### Backend

- **Node.js + Express.js** - REST API server
- **PostgreSQL** (via Supabase) - Database with connection pooling
- **JWT** - Secure token-based authentication
- **bcryptjs** - Password hashing and security
- **CORS** - Cross-Origin Resource Sharing
- **Multer** - File upload handling

## Project Structure

```
E-lib/
├── index.html              # Main SPA entry point
├── css/
│   └── style.css           # Application styles
├── js/
│   └── app.js              # Frontend logic
├── public/
│   └── books/
│       └── books.json      # Book data
└── server/
    ├── index.js            # Express server setup
    ├── package.json        # Backend dependencies
    ├── db.js               # Database connection
    ├── init.sql            # Database schema
    ├── .env                # Environment variables
    ├── middleware/
    │   └── auth.js         # JWT authentication middleware
    └── routes/
        ├── auth.js         # Authentication endpoints
        └── books.js        # Book management endpoints
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Supabase account (for PostgreSQL database)
- `.env` file with required configuration

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd E-lib
   ```

2. **Install backend dependencies**

   ```bash
   cd server
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the `server/` directory:

   ```env
   # PostgreSQL Connection (Supabase)
   DB_HOST=your_supabase_host
   DB_PORT=5432
   DB_NAME=postgres
   DB_USER=postgres
   DB_PASSWORD=your_password

   # Or use Supabase connection string
   SUPABASE_DATABASE_URL=postgresql://user:password@host:5432/dbname

   # JWT Configuration
   JWT_SECRET=your_secret_key_change_in_production

   # Server Configuration
   PORT=3001
   ```

4. **Initialize the database**
   ```bash
   # Execute init.sql on your Supabase database
   psql -h your_host -U postgres -d postgres -f server/init.sql
   ```

### Running the Application

**Development mode** (with auto-reload):

```bash
cd server
npm run dev
```

**Production mode**:

```bash
cd server
npm start
```

The server will start on `http://localhost:3001` and serve the frontend from the parent directory.

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get JWT token

### Books

- `GET /api/books` - Get all books
- `GET /api/books/:id` - Get book details
- `POST /api/books` - Add a new book (requires auth)
- `PUT /api/books/:id` - Update book (requires auth)
- `DELETE /api/books/:id` - Delete book (requires auth)

### Health

- `GET /api/health` - Server health check

## Features

✨ **Authentication & Security**

- JWT-based authentication
- Password hashing with bcryptjs
- Protected routes with middleware

🌐 **CORS Enabled**

- Configured for local development
- Customizable for production

📚 **Book Management**

- Browse books
- Search and filter capabilities
- Add/update/delete books (authenticated users)

📱 **Responsive Design**

- Mobile-friendly interface
- Modern UI with smooth interactions

## Environment Variables

| Variable                | Description            | Example                          |
| ----------------------- | ---------------------- | -------------------------------- |
| `SUPABASE_DATABASE_URL` | Full connection string | `postgresql://user:pass@host/db` |
| `JWT_SECRET`            | Secret for JWT signing | `your_secret_key`                |
| `PORT`                  | Server port            | `3001`                           |

## Development Tips

- Use `npm run dev` for development with automatic restarts
- Check `/api/health` endpoint for server status
- Browser DevTools for frontend debugging
- Check server console for API logs


## Database

The application uses PostgreSQL via Supabase with connection pooling. The schema is initialized via `server/init.sql`.

**Connection Methods:**

1. Connection string using SUPABASE_DATABASE_URL (recommended for Supabase)



**E-Libra** — Bringing the library to your screen. 📖✨
