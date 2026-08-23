from ..services.session_service import SessionService
from fastapi.responses import JSONResponse

class SessionController:
    @staticmethod
    def start_session(user_id: str | None, store_id: str) -> JSONResponse:
        """
        Co-ordinates shopping session starts.
        """
        result = SessionService.start_session(user_id, store_id)
        formatted_data = {
            "sessionId": result["id"],
            "storeId": result["storeId"],
            "status": result["status"]
        }
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "Shopping session started",
                "data": formatted_data
            }
        )
