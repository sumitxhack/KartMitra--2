from pydantic import BaseModel

class SessionStartRequest(BaseModel):
    storeId: str
