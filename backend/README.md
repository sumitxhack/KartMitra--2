# KartMitra Backend Foundation

This is the production-ready REST API backend foundation for **KartMitra** built using **Node.js**, **Express.js**, and **TypeScript**.

> [!IMPORTANT]
> **Database integration is intentionally not implemented in this phase.**
> Currently, all service layers return mock/placeholder responses. The API architecture is designed so that you can easily swap out these mocks with real database queries (e.g., using Mongoose or Prisma ORM) and external API integrations in future phases.

## Project Structure

```text
backend/
├── src/
│   ├── config/          # Environment configuration loading
│   ├── controllers/     # Route controllers coordinating request and response
│   ├── routes/          # Express route definitions grouped by domain
│   ├── middleware/      # Middlewares (auth, errorHandler, rateLimiter, validate)
│   ├── services/        # Business logic & mock data services
│   ├── utils/           # Shared utility classes (ApiResponse, ApiError, logger)
│   ├── app.ts           # Express Application definition
│   └── server.ts        # Server entrypoint
├── .env                 # Environment variables (gitignored)
├── .env.example         # Template for environment configuration
├── .gitignore           # Git ignore definitions
├── package.json         # Node.js dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── README.md            # Setup and deployment documentation
└── API_DOCUMENTATION.md # API endpoint reference
```

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Ensure `.env` is created. You can copy the example file:
   ```bash
   cp .env.example .env
   ```

### Running the App

- **Development Mode** (with hot-reload):
  ```bash
  npm run dev
  ```
- **Build the Application**:
  ```bash
  npm run build
  ```
- **Production Mode** (runs built code):
  ```bash
  npm run start
  ```
- **Type Checking**:
  ```bash
  npm run typecheck
  ```

## Environment Variables

The application configures the following environment variables:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | The port the HTTP server listens on | `5000` |
| `NODE_ENV` | Application environment (`development` or `production`) | `development` |
| `FRONTEND_URL` | The URL of the Next.js frontend for CORS validation | `http://localhost:3000` |
| `JWT_SECRET` | Secret key used for signing JWT auth tokens | `super_secret_key` |

## How to Add Database Later

To hook up a database (e.g., MongoDB, PostgreSQL, or MySQL with Prisma/Mongoose):
1. **Install ORM / Client**: Add the package (e.g., `npm install prisma @prisma/client` or `npm install mongoose`).
2. **Configure Connection**: Create a connection configuration under `src/config/database.ts` and update `.env` with the connection URI.
3. **Define Models/Schemas**: Setup ORM schemas.
4. **Update Services**: Swap the in-memory mock data operations in the `src/services/` folder with actual database queries (e.g., replacing `mockProducts` operations with `await prisma.product.findMany()`).
5. **No Controller Changes**: Because of the modular `Route -> Controller -> Service` architecture, the controllers and route definitions will remain unchanged, ensuring a clean separation of concerns.

## API Documentation

For a list of all endpoints, parameters, request body schemas, and response examples, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).
