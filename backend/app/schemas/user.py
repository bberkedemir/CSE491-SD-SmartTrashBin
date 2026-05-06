from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
from app.models.user import UserRole


class UserCreate(BaseModel):
    # What frontend sends when REGISTERING
    username: str
    email: EmailStr
    full_name: str
    password: str
    client_type: Optional[str] = "web"


class UserLogin(BaseModel):
    # What frontend sends when LOGGING IN
    username: str
    password: str


class UserResponse(BaseModel):
    # What backend returns about a user — NEVER includes password
    id: int
    username: str
    email: str
    full_name: str
    role : UserRole
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    # What backend returns after successful login/register
    user: UserResponse
    token: str
    token_type: str = "bearer"