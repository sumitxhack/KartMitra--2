from ..services.auth_service import AuthService
from fastapi.responses import JSONResponse

class AuthController:
    @staticmethod
    def login(data: dict) -> JSONResponse:
        """
        Handle login actions.
        """
        result = AuthService.login(data["email"], data["password"])
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "Login successful",
                "data": result
            }
        )

    @staticmethod
    def register(data: dict) -> JSONResponse:
        """
        Handle registration actions.
        """
        result = AuthService.register(data)
        return JSONResponse(
            status_code=201,
            content={
                "success": True,
                "message": "Registration successful",
                "data": result
            }
        )
