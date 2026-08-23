from fastapi import APIRouter
from ..schemas.auth_schema import LoginRequest, RegisterRequest
from ..controllers.auth_controller import AuthController

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login")
def login(payload: LoginRequest):
    """
    Log in a user and issue JWT.
    """
    return AuthController.login(payload.model_dump())

@router.post("/register")
def register(payload: RegisterRequest):
    """
    Register a new user.
    """
    return AuthController.register(payload.model_dump())
