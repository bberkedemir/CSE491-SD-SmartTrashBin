from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.auth_dependency import get_current_user, get_current_admin_user
from app.models.user import User
from app.schemas.truck import TruckCreate, TruckUpdate, TruckResponse, TruckAssignRequest
from app.crud.truck import truck_crud

router = APIRouter()


@router.get("/my-truck", response_model=TruckResponse)
def get_my_truck(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    truck = truck_crud.get_truck_for_driver(db, current_user.id)
    if not truck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No truck assigned to you")
    return truck_crud._to_response(db, truck)


@router.get("/", response_model=List[TruckResponse])
def list_trucks(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    return truck_crud.get_all(db, skip=skip, limit=limit)


@router.get("/{truck_id}", response_model=TruckResponse)
def get_truck(
    truck_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    truck = truck_crud.get(db, truck_id)
    if not truck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Truck not found")
    return truck


@router.post("/", response_model=TruckResponse, status_code=status.HTTP_201_CREATED)
def create_truck(
    data: TruckCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    return truck_crud.create(db, data)


@router.put("/{truck_id}", response_model=TruckResponse)
def update_truck_put(
    truck_id: int,
    data: TruckUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    return truck_crud.update(db, truck_id, data)


@router.patch("/{truck_id}", response_model=TruckResponse)
def update_truck_patch(
    truck_id: int,
    data: TruckUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    return truck_crud.update(db, truck_id, data)


@router.delete("/{truck_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_truck(
    truck_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    if not truck_crud.delete(db, truck_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Truck not found")


@router.patch("/{truck_id}/assign", response_model=TruckResponse)
def assign_driver(
    truck_id: int,
    body: TruckAssignRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    return truck_crud.assign_driver(db, truck_id, body.driver_id)
