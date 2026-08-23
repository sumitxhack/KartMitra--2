from pydantic import BaseModel

class MockPaymentRequest(BaseModel):
    sessionId: str
    amount: float
