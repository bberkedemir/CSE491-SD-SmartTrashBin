from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional, Dict, Any
from app.models.bin import Bin as BinModel
from app.schemas.bin import BinCreate, BinUpdate, BulkImportResult


class BinCRUD:
    def get(self, db: Session, bin_id: int) -> Optional[BinModel]:
        """Get a single bin by ID"""
        return db.get(BinModel, bin_id)

    def get_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[BinModel]:
        """Get all bins with pagination"""
        stmt = select(BinModel).offset(skip).limit(limit)
        result = db.execute(stmt)
        return result.scalars().all()

    def get_count(self, db: Session) -> int:
        """Get total count of bins"""
        stmt = select(BinModel)
        result = db.execute(stmt)
        return len(result.scalars().all())

    def create(self, db: Session, bin_data: BinCreate) -> BinModel:
<<<<<<< HEAD
        """Create a new bin"""
=======
        """Create a new bin. If a bin exists at the exact same location, update it."""
        # Check for existing bin with same location
        stmt = select(BinModel).where(
            BinModel.lat == bin_data.lat,
            BinModel.lng == bin_data.lng
        )
        existing_bin = db.execute(stmt).scalar_one_or_none()

        if existing_bin:
            # Update existing instead of creating duplicate
            existing_bin.fill = bin_data.fill
            existing_bin.title = bin_data.title
            db.commit()
            db.refresh(existing_bin)
            return existing_bin

        # Create new if doesn't exist
>>>>>>> origin/main
        db_bin = BinModel(**bin_data.model_dump())
        db.add(db_bin)
        db.commit()
        db.refresh(db_bin)
        return db_bin

    def update(self, db: Session, bin_id: int, bin_data: BinUpdate) -> Optional[BinModel]:
        """Update an existing bin"""
        db_bin = self.get(db, bin_id)
        if not db_bin:
            return None
        
        update_data = bin_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_bin, field, value)
        
        db.commit()
        db.refresh(db_bin)
        return db_bin

    def delete(self, db: Session, bin_id: int) -> bool:
        """Delete a bin"""
        db_bin = self.get(db, bin_id)
        if not db_bin:
            return False
        
        db.delete(db_bin)
        db.commit()
        return True

    def validate_bin_data(self, bin_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate bin data and return error if invalid"""
        errors = []
        
        # Validate lat
        lat = bin_data.get('lat')
        if lat is None:
            errors.append("Latitude is required")
        elif not isinstance(lat, (int, float)) or not (-90 <= lat <= 90):
            errors.append(f"Invalid latitude: {lat}. Must be between -90 and 90")
        
        # Validate lng
        lng = bin_data.get('lng')
        if lng is None:
            errors.append("Longitude is required")
        elif not isinstance(lng, (int, float)) or not (-180 <= lng <= 180):
            errors.append(f"Invalid longitude: {lng}. Must be between -180 and 180")
        
        # Validate title
        title = bin_data.get('title')
        if title is None:
            errors.append("Title is required")
        elif not isinstance(title, str) or len(title.strip()) == 0:
            errors.append("Title cannot be empty")
        elif len(title) > 255:
            errors.append(f"Title too long: {len(title)} characters. Maximum 255 allowed.")
        
        # Validate fill
        fill = bin_data.get('fill')
        if fill is None:
            errors.append("Fill percentage is required")
        elif not isinstance(fill, (int, float)) or not (0 <= fill <= 100):
            errors.append(f"Invalid fill percentage: {fill}. Must be between 0 and 100")
        
        return {"valid": len(errors) == 0, "errors": errors}

    def create_bulk(self, db: Session, bins_data: List[Dict[str, Any]]) -> BulkImportResult:
        """Create multiple bins with validation, skipping invalid entries"""
        created_bins = []
        errors = []
        
        for i, bin_data in enumerate(bins_data):
            validation = self.validate_bin_data(bin_data)
            
            if validation["valid"]:
                try:
                    # Create BinCreate object for proper validation
                    bin_create = BinCreate(
                        lat=float(bin_data["lat"]),
                        lng=float(bin_data["lng"]),
                        title=str(bin_data["title"]).strip(),
                        fill=int(bin_data["fill"])
                    )

                    # Check for existing bin with same location
                    stmt = select(BinModel).where(
                        BinModel.lat == float(bin_data["lat"]),
                        BinModel.lng == float(bin_data["lng"])
                    )
                    existing_bin = db.execute(stmt).scalar_one_or_none()

                    if existing_bin:
                        # Update existing bin
                        existing_bin.fill = int(bin_data["fill"])
                        existing_bin.title = str(bin_data["title"]).strip()
                        created_bins.append(existing_bin)
                    else:
                        # Create new bin
                        db_bin = BinModel(**bin_create.model_dump())
                        db.add(db_bin)
                        created_bins.append(db_bin)
                except Exception as e:
                    errors.append({
                        "index": i + 1,
                        "data": bin_data,
                        "error": f"Failed to process bin: {str(e)}"
                    })
            else:
                errors.append({
                    "index": i + 1,
                    "data": bin_data,
                    "errors": validation["errors"]
                })
        
        # Commit all valid bins at once
        if created_bins:
            try:
                db.commit()
                for bin in created_bins:
                    db.refresh(bin)
            except Exception as e:
                db.rollback()
                return BulkImportResult(
                    success_count=0,
                    skipped_count=len(bins_data),
                    errors=[{"error": f"Database transaction failed: {str(e)}"}]
                )
        
        skipped_count = len(bins_data) - len(created_bins)
        
        return BulkImportResult(
            success_count=len(created_bins),
            skipped_count=skipped_count,
            errors=errors,
            processed_bins=[
                {"id": b.id, "lat": b.lat, "lng": b.lng, "title": b.title, "fill": b.fill, "created_at": b.created_at, "updated_at": b.updated_at} 
                for b in created_bins
            ]
        )


# Create a singleton instance
bin_crud = BinCRUD()