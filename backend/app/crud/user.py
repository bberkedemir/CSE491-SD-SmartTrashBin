from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.schemas.user import UserCreate
from app.services.auth_service import AuthService


def get_user_by_username(db: Session, username: str) -> User | None:
    # Find a user by their username
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> User | None:
    # Find a user by their email
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    # Find a user by their ID
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, user_data: UserCreate) -> User:
    # Create a new user — password is hashed before storing
    hashed_pw = AuthService.hash_password(user_data.password)

    assigned_role = UserRole.TRUCK_DRIVER if user_data.client_type == "mobile" else UserRole.ADMIN

    db_user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=hashed_pw,
        role=assigned_role,
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_users(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    return db.query(User).offset(skip).limit(limit).all()

def update_user_status(db: Session, user_id: int, is_active: bool) -> User | None:
    user = get_user_by_id(db, user_id)
    if user:
        user.is_active = is_active
        db.commit()
        db.refresh(user)
    return user

def update_user_role(db: Session, user_id: int, role: UserRole) -> User | None:
    user = get_user_by_id(db, user_id)
    if user:
        user.role = role
        db.commit()
        db.refresh(user)
    return user