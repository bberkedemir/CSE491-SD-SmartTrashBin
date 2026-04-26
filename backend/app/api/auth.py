import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.core.database import get_db
from app.core.auth_dependency import get_current_user
from app.models.user import User, UserRole
from app.models.token_blacklist import TokenBlacklist
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.crud import user as user_crud
from app.services.auth_service import AuthService

logger = logging.getLogger("auth.api")

router = APIRouter()
security = HTTPBearer()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    logger.info(f"[REGISTER] Attempt: username='{user_data.username}', email='{user_data.email}'")

    try:
        existing = user_crud.get_user_by_username(db, user_data.username)
        if existing:
            logger.warning(f"[REGISTER] REJECTED — username '{user_data.username}' is already taken (existing user ID: {existing.id})")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Username '{user_data.username}' is already taken"
            )

        existing = user_crud.get_user_by_email(db, user_data.email)
        if existing:
            logger.warning(f"[REGISTER] REJECTED — email '{user_data.email}' is already registered (existing user ID: {existing.id})")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{user_data.email}' is already registered"
            )

        new_user = user_crud.create_user(db, user_data)
        token = AuthService.create_access_token(new_user.id, new_user.username)

        logger.info(f"[REGISTER] SUCCESS — user '{new_user.username}' created (ID: {new_user.id}, Role: {new_user.role})")
        return TokenResponse(
            user=UserResponse.model_validate(new_user),
            token=token
        )
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(
            f"[REGISTER] DATABASE ERROR while registering '{user_data.username}': {type(e).__name__}: {e}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during registration: {type(e).__name__} — check backend logs for details"
        )
    except Exception as e:
        logger.error(
            f"[REGISTER] UNEXPECTED ERROR for '{user_data.username}': {type(e).__name__}: {e}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during registration: {type(e).__name__} — check backend logs for details"
        )


@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    logger.info(f"[LOGIN] Attempt: username='{credentials.username}'")

    try:
        user = user_crud.get_user_by_username(db, credentials.username)
        if not user:
            logger.warning(f"[LOGIN] FAILED — username '{credentials.username}' does not exist in the database")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"No account found with username '{credentials.username}'"
            )

        if not AuthService.verify_password(credentials.password, user.hashed_password):
            logger.warning(f"[LOGIN] FAILED — wrong password for user '{credentials.username}' (ID: {user.id})")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password"
            )

        if not user.is_active:
            logger.warning(f"[LOGIN] REJECTED — user '{credentials.username}' (ID: {user.id}) account is deactivated")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account '{credentials.username}' is deactivated — contact an administrator"
            )

        token = AuthService.create_access_token(user.id, user.username)
        logger.info(f"[LOGIN] SUCCESS — user '{user.username}' (ID: {user.id}, Role: {user.role}) logged in")

        return TokenResponse(
            user=UserResponse.model_validate(user),
            token=token
        )
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(
            f"[LOGIN] DATABASE ERROR for '{credentials.username}': {type(e).__name__}: {e}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during login: {type(e).__name__} — check backend logs for details"
        )
    except Exception as e:
        logger.error(
            f"[LOGIN] UNEXPECTED ERROR for '{credentials.username}': {type(e).__name__}: {e}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during login: {type(e).__name__} — check backend logs for details"
        )


@router.get("/me", response_model=UserResponse)
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    token = credentials.credentials

    # Check if already blacklisted
    existing = db.query(TokenBlacklist).filter(TokenBlacklist.token == token).first()
    if not existing:
        blacklisted_token = TokenBlacklist(token=token)
        db.add(blacklisted_token)
        db.commit()

    return {"message": "Successfully logged out"}


@router.post("/make-me-truck-driver/{username}")
def make_me_truck_driver(username: str, db: Session = Depends(get_db)):
    """
    CAUTION: This is a backdoor! Only for local development!
    """
    user = user_crud.get_user_by_username(db, username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.role = UserRole.TRUCK_DRIVER
    db.commit()
    return {"message": f"{username} is now a truck driver"}


@router.post("/register-driver", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_driver(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user as truck driver (mobile app)"""
    logger.info(f"[REGISTER-DRIVER] Attempt: username='{user_data.username}', email='{user_data.email}'")

    try:
        existing = user_crud.get_user_by_username(db, user_data.username)
        if existing:
            logger.warning(f"[REGISTER-DRIVER] REJECTED — username '{user_data.username}' is already taken")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Username '{user_data.username}' is already taken"
            )

        existing = user_crud.get_user_by_email(db, user_data.email)
        if existing:
            logger.warning(f"[REGISTER-DRIVER] REJECTED — email '{user_data.email}' is already registered")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{user_data.email}' is already registered"
            )

        new_user = user_crud.create_user_with_role(db, user_data, UserRole.TRUCK_DRIVER)
        token = AuthService.create_access_token(new_user.id, new_user.username)

        logger.info(f"[REGISTER-DRIVER] SUCCESS — user '{new_user.username}' created as truck_driver (ID: {new_user.id})")
        return TokenResponse(
            user=UserResponse.model_validate(new_user),
            token=token
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[REGISTER-DRIVER] ERROR for '{user_data.username}': {type(e).__name__}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during registration: {type(e).__name__}"
        )