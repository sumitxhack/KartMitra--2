from fastapi import APIRouter, Depends
from ..schemas.payment_schema import MockPaymentRequest
from ..controllers.payment_controller import PaymentController
from ..utils.dependencies import get_current_user

router = APIRouter(prefix="/payment", tags=["payment"])

@router.post("/mock")
def create_mock_payment(payload: MockPaymentRequest, current_user: dict = Depends(get_current_user)):
    """
    Process mock payment checkout.
    """
    return PaymentController.create_mock_payment(payload.sessionId, payload.amount)
