# KartMitra

Smart Shopping & AI Verification Lab Prototype.

## Development Launchers

### `START_ALL.bat`
Starts all application servers in separate terminal windows:
- **[1] AI Verification Lab Backend** (`http://localhost:8000`)
- **[2] AI Verification Lab Frontend** (`http://localhost:3000`)
- **[3] KartMitra Backend** (`http://localhost:5000`)
- **[4] KartMitra Frontend** (`http://localhost:5173`)

### `STOP_ALL.bat`
Stops the development servers (ports 8000, 3000, 5000, 5173) without affecting PostgreSQL, MongoDB, or other Node/Python processes on your machine.

## Key URLs
- **Customer UI:** `http://localhost:5173/`
- **Admin Portal:** `http://localhost:5173/admin`
- **AI Verification Lab:** `http://localhost:3000`
- **FastAPI Backend:** `http://localhost:8000`
- **KartMitra Express API:** `http://localhost:5000`