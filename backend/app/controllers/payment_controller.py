from ..services.payment_service import PaymentService
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

class PaymentController:
    @staticmethod
    def create_mock_payment(session_id: str, amount: float) -> JSONResponse:
        """
        Handle mock checkout payments.
        """
        result = PaymentService.create_mock_payment(session_id, amount)
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "Mock payment successful",
                "data": jsonable_encoder(result)
            }
        )
