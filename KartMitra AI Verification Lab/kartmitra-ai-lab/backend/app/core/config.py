from pydantic_settings import BaseSettings
from typing import List, Union

class Settings(BaseSettings):
    PROJECT_NAME: str = "KartMitra AI Verification Lab"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password123@localhost:5432/kartmitra_lab"
    SYNC_DATABASE_URL: str = "postgresql+psycopg2://postgres:password123@localhost:5432/kartmitra_lab"
    CORS_ORIGINS: Union[str, List[str]] = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def get_cors_origins(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, str):
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        return self.CORS_ORIGINS

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
