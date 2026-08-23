from fastapi import Header, HTTPException
from .jwt_utils import decode_access_token

def get_current_user(authorization: str = Header(None)) -> dict:
    """
    FastAPI dependency that extracts the JWT token from the Authorization header
    and returns the decoded user payload. Supports mock validation fallbacks.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication token required")
    
    token = authorization.split(" ")[1]
    
    # Mock token validation for frontend development
    if token == "mock-jwt-token-for-testing":
        return {
            "id": "mock-user-id-123",
            "email": "admin@kartmitra.com",
            "role": "admin"
        }
        
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired authentication token")
        
    return payload
