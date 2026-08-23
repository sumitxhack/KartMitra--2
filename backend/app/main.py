import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config.settings import settings
from .config.database import test_connection, db_pool
from .migrate import run_migrations
from .routers import auth, session, products, cart, payment
from .utils.logger import logger

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI Lifespan Context Manager. Handles startup DB checks/migrations
    and graceful pool closure on shutdown.
    """
    logger.info("Starting KartMitra FastAPI Backend...")
    try:
        # Verify PostgreSQL database connection
        test_connection()
        # Run SQL migration scripts
        run_migrations()
    except Exception as e:
        logger.error(f"FATAL: Database startup initialization failed: {e}")
        sys.exit(1)

    yield

    logger.info("Shutting down KartMitra FastAPI Backend...")
    if db_pool:
        db_pool.closeall()
        logger.info("Database connection pool successfully closed.")

app = FastAPI(
    title="KartMitra API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Policy configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception mapping for standard API response output
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.detail,
            "error": {}
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = {}
    for err in exc.errors():
        # Clean path formatting
        field = ".".join(str(p) for p in err["loc"][1:])
        errors[field] = err["msg"]
        
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "message": "Validation Error",
            "error": {"details": errors}
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled general exception: {exc}", exc_info=True)
    message = "Internal Server Error" if settings.NODE_ENV == "production" else str(exc)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": message,
            "error": {}
        }
    )

# Mount APIRouters under /api/v1
api_prefix = "/api/v1"
app.include_router(auth.router, prefix=api_prefix)
app.include_router(session.router, prefix=api_prefix)
app.include_router(products.router, prefix=api_prefix)
app.include_router(cart.router, prefix=api_prefix)
app.include_router(payment.router, prefix=api_prefix)

# API Health Check Endpoint
@app.get("/api/v1/health", tags=["health"])
def health():
    return {
        "success": True,
        "message": "KartMitra backend is running",
        "data": {
            "server": "ok",
            "database": "connected" if db_pool else "not_connected"
        }
    }
