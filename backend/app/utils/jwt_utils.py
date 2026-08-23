import jwt
from datetime import datetime, timedelta, timezone
from ..config.settings import settings

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """
    Generate JWT session token.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=24)
        
    to_encode.update({"exp": int(expire.timestamp())})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")
    return encoded_jwt

def decode_access_token(token: str) -> dict | None:
    """
    Decode and validate a JWT access token.
    """
    try:
        # HS256 validation
        decoded_payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return decoded_payload
    except jwt.PyJWTError:
        return None
