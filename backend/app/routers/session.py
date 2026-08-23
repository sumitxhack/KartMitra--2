from fastapi import APIRouter, Depends
from ..schemas.session_schema import SessionStartRequest
from ..controllers.session_controller import SessionController
from ..utils.dependencies import get_current_user

router = APIRouter(prefix="/session", tags=["session"])

@router.post("/start")
def start_session(payload: SessionStartRequest, current_user: dict = Depends(get_current_user)):
    """
    Start a new shopping session for the authenticated user.
    """
    user_id = current_user.get("id")
    return SessionController.start_session(user_id, payload.storeId)
