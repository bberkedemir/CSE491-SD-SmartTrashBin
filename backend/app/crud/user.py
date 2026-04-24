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

    db_user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=hashed_pw,
        role=UserRole.TRUCK_DRIVER,
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user