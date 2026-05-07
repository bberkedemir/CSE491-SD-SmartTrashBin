from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from app.models.truck import Truck, TruckStatus
from app.models.user import User, UserRole
from app.schemas.truck import TruckCreate, TruckUpdate, TruckResponse


class TruckCRUD:

    def _to_response(self, db: Session, truck: Truck) -> TruckResponse:
        driver = db.get(User, truck.assigned_driver_id) if truck.assigned_driver_id else None
        data = {
            "id": truck.id,
            "license_plate": truck.license_plate,
            "model": truck.model,
            "capacity_bins": truck.capacity_bins,
            "status": truck.status,
            "assigned_driver_id": truck.assigned_driver_id,
            "assigned_driver": driver,
        }
        return TruckResponse.model_validate(data)

    def _validate_driver(self, db: Session, driver_id: int, exclude_truck_id: Optional[int] = None) -> User:
        user = db.get(User, driver_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")
        role_val = user.role.value if hasattr(user.role, "value") else user.role
        if role_val != "truck_driver":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is not a truck driver")
        existing = db.query(Truck).filter(Truck.assigned_driver_id == driver_id)
        if exclude_truck_id:
            existing = existing.filter(Truck.id != exclude_truck_id)
        if existing.first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Driver already assigned to another truck")
        return user

    def get(self, db: Session, truck_id: int) -> Optional[TruckResponse]:
        truck = db.get(Truck, truck_id)
        if not truck:
            return None
        return self._to_response(db, truck)

    def get_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[TruckResponse]:
        trucks = db.query(Truck).offset(skip).limit(limit).all()
        return [self._to_response(db, t) for t in trucks]

    def get_by_license_plate(self, db: Session, license_plate: str) -> Optional[Truck]:
        return db.query(Truck).filter(Truck.license_plate == license_plate).first()

    def get_truck_for_driver(self, db: Session, driver_id: int) -> Optional[Truck]:
        return db.query(Truck).filter(Truck.assigned_driver_id == driver_id).first()

    def create(self, db: Session, data: TruckCreate) -> TruckResponse:
        if self.get_by_license_plate(db, data.license_plate):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="License plate already exists")
        if data.assigned_driver_id:
            self._validate_driver(db, data.assigned_driver_id)
        truck = Truck(
            license_plate=data.license_plate,
            model=data.model,
            capacity_bins=data.capacity_bins,
            status=TruckStatus.IN_SERVICE if data.assigned_driver_id else (data.status or TruckStatus.AVAILABLE),
            assigned_driver_id=data.assigned_driver_id,
        )
        try:
            db.add(truck)
            db.commit()
            db.refresh(truck)
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Truck already exists")
        return self._to_response(db, truck)

    def update(self, db: Session, truck_id: int, data: TruckUpdate) -> TruckResponse:
        truck = db.get(Truck, truck_id)
        if not truck:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Truck not found")
        if data.assigned_driver_id is not None:
            self._validate_driver(db, data.assigned_driver_id, exclude_truck_id=truck_id)
        unset_fields = data.model_dump(exclude_unset=True)
        for field, value in unset_fields.items():
            setattr(truck, field, value)
        if data.assigned_driver_id:
            truck.status = TruckStatus.IN_SERVICE
        elif 'assigned_driver_id' in unset_fields and data.assigned_driver_id is None:
            truck.status = TruckStatus.AVAILABLE
        try:
            db.commit()
            db.refresh(truck)
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Conflict updating truck")
        return self._to_response(db, truck)

    def assign_driver(self, db: Session, truck_id: int, driver_id: Optional[int]) -> TruckResponse:
        truck = db.get(Truck, truck_id)
        if not truck:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Truck not found")
        if driver_id is not None:
            self._validate_driver(db, driver_id, exclude_truck_id=truck_id)
            truck.assigned_driver_id = driver_id
            truck.status = TruckStatus.IN_SERVICE
        else:
            truck.assigned_driver_id = None
            truck.status = TruckStatus.AVAILABLE
        try:
            db.commit()
            db.refresh(truck)
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Driver already assigned to another truck")
        return self._to_response(db, truck)

    def delete(self, db: Session, truck_id: int) -> bool:
        truck = db.get(Truck, truck_id)
        if not truck:
            return False
        db.delete(truck)
        db.commit()
        return True


truck_crud = TruckCRUD()
