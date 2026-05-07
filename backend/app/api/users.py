from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth_dependency import get_current_admin_user
from app.models.user import User, UserRole
from app.schemas.user import UserResponse
from app.crud import user as user_crud
from pydantic import BaseModel

router = APIRouter()

class UserStatusUpdate(BaseModel):
    is_active: bool

class UserRoleUpdate(BaseModel):
    role: UserRole

@router.get("/", response_model=list[UserResponse])
def get_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin_user)):
    users = user_crud.get_users(db, skip=skip, limit=limit)
    return users

@router.patch("/{user_id}/status", response_model=UserResponse)
def update_user_status(user_id: int, status_update: UserStatusUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin_user)):
    user = user_crud.update_user_status(db, user_id, status_update.is_active)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.patch("/{user_id}/role", response_model=UserResponse)
def update_user_role(user_id: int, role_update: UserRoleUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin_user)):
    user = user_crud.update_user_role(db, user_id, role_update.role)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
