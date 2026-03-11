from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User , UserRole
from app.models.token_blacklist import TokenBlacklist
from app.services.auth_service import AuthService

security = HTTPBearer()


import sys

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:

    token = credentials.credentials

    payload = AuthService.verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if token has been blacklisted (logout)
    blacklisted = db.query(TokenBlacklist).filter(TokenBlacklist.token == token).first()
    if blacklisted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        print(f"DEBUG: User ID {user_id} not found in DB", flush=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    print(f"DEBUG: Request from {user.username} (ID: {user.id}, Role: {user.role}, Type: {type(user.role)})", flush=True)
    if not user.is_active:
        print(f"DEBUG: User {user.username} is NOT active", flush=True)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    return user

def get_current_admin_user(current_user: User = Depends( get_current_user)) -> User:
    # Use string comparison to avoid Enum object comparison issues
    user_role_str = str(current_user.role.value if hasattr(current_user.role, 'value') else current_user.role)
    print(f"DEBUG: Admin check for {current_user.username}. Role str: '{user_role_str}'", flush=True)
    
    if user_role_str != "admin":
        print(f"DEBUG: User {current_user.username} REJECTED - not admin", flush=True)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can access this resource",
        )
    return current_user
