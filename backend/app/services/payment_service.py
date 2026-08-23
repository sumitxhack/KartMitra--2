import uuid
from ..repositories.session_repository import SessionRepository
from fastapi import HTTPException

class PaymentService:
    @staticmethod
    def create_mock_payment(session_id: str, amount: float) -> dict:
        """
        Process a mock payment. Flags the shopping session as completed in the DB.
        """
        # Validate session
        session = SessionRepository.find_by_id(session_id)
        if not session:
            raise HTTPException(status_code=404, detail=f"Shopping session {session_id} not found")

        # Mark shopping session as completed
        SessionRepository.update_status(session_id, "completed")

        mock_payment_id = f"pay_{uuid.uuid4().hex[:12]}"
        
        return {
            "paymentId": mock_payment_id,
            "status": "success",
            "amount": amount
        }
