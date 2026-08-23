import bcrypt
from datetime import timedelta
from ..repositories.user_repository import UserRepository
from ..utils.jwt_utils import create_access_token
from fastapi import HTTPException

class AuthService:
    @staticmethod
    def hash_password(password: str) -> str:
        """
        Hash password using bcrypt.
        """
        pwd_bytes = password.encode('utf-8')
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """
        Verify password using bcrypt.
        """
        try:
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        except Exception:
            return False

    @staticmethod
    def register(data: dict) -> dict:
        """
        Register a new user.
        """
        existing = UserRepository.find_by_email(data["email"])
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")
        
        # Hash password
        data["password"] = AuthService.hash_password(data["password"])
        user = UserRepository.create(data)
        
        # Generate token
        token = create_access_token({"id": user["id"], "email": user["email"], "role": user["role"]})
        return {"token": token, "user": user}

    @staticmethod
    def login(email: str, password: str) -> dict:
        """
        Log in a user. Includes auto-registration of the default admin for testing convenience.
        """
        user = UserRepository.find_by_email(email)
        
        # Auto-seed testing account
        if not user and email == "admin@kartmitra.com":
            try:
                AuthService.register({
                    "email": "admin@kartmitra.com",
                    "password": password if password else "password123",
                    "name": "Admin User",
                    "role": "admin"
                })
                user = UserRepository.find_by_email(email)
            except Exception:
                pass

        if not user or not AuthService.verify_password(password, user["password"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
            
        token = create_access_token({"id": user["id"], "email": user["email"], "role": user["role"]})
        
        user_response = user.copy()
        user_response.pop("password", None)
        
        return {"token": token, "user": user_response}
