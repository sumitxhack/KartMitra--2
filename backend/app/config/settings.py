import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PORT: int = 5000
    NODE_ENV: str = "development"
    FRONTEND_URL: str = "http://localhost:3000"
    JWT_SECRET: str = "local_development_jwt_secret_12345"
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/kartmitra"

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(__file__), "../../../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
