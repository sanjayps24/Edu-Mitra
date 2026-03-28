"""
auth_routes.py — Authentication endpoints.
Handles user registration and login with JWT token issuance.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from models import UserRegister, UserLogin, TokenResponse
from auth import hash_password, verify_password, create_access_token, get_current_user
from database import get_db
from database_models import User

router = APIRouter()


@router.post("/register", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register(user: UserRegister, db: Session = Depends(get_db)):
    """
    Register a new user (student / teacher / admin).
    - Checks for duplicate email
    - Hashes password before storing
    - Returns success message
    """
    # Check if email already exists
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists."
        )

    # Store user with hashed password
    new_user = User(
        name=user.name,
        email=user.email,
        password_hash=hash_password(user.password),
        role=user.role.value,
        department=user.department,
    )
    db.add(new_user)
    try:
        db.commit()
        db.refresh(new_user)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )

    # Create JWT token for auto-login
    token = create_access_token({
        "sub": str(new_user.id),
        "role": new_user.role,
        "name": new_user.name,
        "email": new_user.email,
    })

    return {
        "message": "Account created successfully.",
        "user_id": str(new_user.id),
        "role": new_user.role,
        "name": new_user.name,
        "access_token": token,
        "token_type": "bearer"
    }


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate user and return a signed JWT token.
    - Validates email/password
    - Returns access_token, role, user_id, name
    """
    # Fetch user by email
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    # Verify password
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    # Create JWT token with user info embedded
    token = create_access_token({
        "sub": str(user.id),
        "role": user.role,
        "name": user.name,
        "email": user.email,
    })

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        role=user.role,
        user_id=str(user.id),
        name=user.name,
    )


@router.get("/me", response_model=dict)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """
    Return current user's info from their JWT token.
    Protected endpoint — requires Authorization: Bearer <token>.
    """
    return current_user
