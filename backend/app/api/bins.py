from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List
import json
import csv
import io
import random
from app.core.database import get_db
from app.schemas.bin import Bin, BinCreate, BinUpdate, BinList, BinBulkCreate, FileUploadResponse
from app.crud.bin import bin_crud

router = APIRouter()


@router.get("/", response_model=BinList)
def get_bins(
    skip: int = Query(0, ge=0, description="Number of bins to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of bins to return"),
    db: Session = Depends(get_db)
):
    """Get all bins with pagination"""
    bins = bin_crud.get_all(db, skip=skip, limit=limit)
    total = bin_crud.get_count(db)
    
    return BinList(
        bins=bins,
        total=total,
        page=skip // limit + 1,
        size=len(bins)
    )


@router.get("/{bin_id}", response_model=Bin)
def get_bin(bin_id: int, db: Session = Depends(get_db)):
    """Get a specific bin by ID"""
    bin = bin_crud.get(db, bin_id)
    if not bin:
        raise HTTPException(status_code=404, detail="Bin not found")
    return bin


@router.post("/", response_model=Bin, status_code=201)
def create_bin(bin_data: BinCreate, db: Session = Depends(get_db)):
    """Create a new bin"""
    return bin_crud.create(db, bin_data)


@router.put("/{bin_id}", response_model=Bin)
def update_bin(bin_id: int, bin_data: BinUpdate, db: Session = Depends(get_db)):
    """Update an existing bin"""
    bin = bin_crud.update(db, bin_id, bin_data)
    if not bin:
        raise HTTPException(status_code=404, detail="Bin not found")
    return bin


@router.post("/{bin_id}/collect", response_model=Bin)
def collect_bin(bin_id: int, db: Session = Depends(get_db)):
    """Simulate collecting waste from a bin, resetting its fill level to 0"""
    bin = bin_crud.update(db, bin_id, BinUpdate(fill=0))
    if not bin:
        raise HTTPException(status_code=404, detail="Bin not found")
    return bin


@router.post("/{bin_id}/throw", response_model=Bin)
def throw_trash(bin_id: int, db: Session = Depends(get_db)):
    """Simulate someone throwing trash into a bin"""
    bin = bin_crud.get(db, bin_id)
    if not bin:
        raise HTTPException(status_code=404, detail="Bin not found")
    
    amount = random.randint(10, 30)
    new_fill = min(100, bin.fill + amount)
    
    updated_bin = bin_crud.update(db, bin_id, BinUpdate(fill=new_fill))
    return updated_bin


@router.post("/simulate-time", status_code=200)
def simulate_time(db: Session = Depends(get_db)):
    """Simulate 12 hours passing over the city, adding random trash to every bin"""
    all_bins = bin_crud.get_all(db, skip=0, limit=10000)
    
    updated_count = 0
    for bin in all_bins:
        amount = random.randint(5, 50)
        new_fill = min(100, bin.fill + amount)
        if new_fill != bin.fill:
            bin_crud.update(db, bin.id, BinUpdate(fill=new_fill))
            updated_count += 1
            
    return {"message": f"Successfully simulated time. Updated {updated_count} bins."}


@router.delete("/{bin_id}", status_code=204)
def delete_bin(bin_id: int, db: Session = Depends(get_db)):
    """Delete a bin"""
    success = bin_crud.delete(db, bin_id)
    if not success:
        raise HTTPException(status_code=404, detail="Bin not found")


@router.post("/bulk", response_model=List[Bin], status_code=201)
def create_bins_bulk(bins_data: BinBulkCreate, db: Session = Depends(get_db)):
    """Bulk import multiple bins from JSON data"""
    result = bin_crud.create_bulk(db, [bin.model_dump() for bin in bins_data.bins])
    
    if result.success_count == 0:
        raise HTTPException(
            status_code=400, 
            detail=f"No valid bins were imported. Errors: {result.errors}"
        )
    
    # Return successfully created bins
    # Return successfully created/updated bins
    return result.processed_bins


@router.post("/upload", response_model=FileUploadResponse, status_code=201)
async def upload_bins_file(
    file: UploadFile = File(..., description="JSON or CSV file containing bin data"),
    db: Session = Depends(get_db)
):
    """Upload and process JSON/CSV file with bin data"""
    
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    file_extension = file.filename.lower().split('.')[-1] if '.' in file.filename else ''
    
    if file_extension not in ['json', 'txt', 'csv']:
        raise HTTPException(
            status_code=400, 
            detail="Invalid file format. Please use JSON (.json, .txt) or CSV (.csv) files."
        )
    
    try:
        # Read file content
        content = await file.read()
        content_str = content.decode('utf-8')
        
        bins_data = []
        
        if file_extension in ['json', 'txt']:
            # Parse JSON
            try:
                bins_data = json.loads(content_str)
                if not isinstance(bins_data, list):
                    raise ValueError("JSON must contain an array of objects")
            except json.JSONDecodeError as e:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid JSON format: {str(e)}"
                )
            except ValueError as e:
                raise HTTPException(
                    status_code=400,
                    detail=str(e)
                )
        
        elif file_extension == 'csv':
            # Parse CSV
            try:
                csv_reader = csv.DictReader(io.StringIO(content_str))
                for row in csv_reader:
                    # Clean and convert CSV data
                    bin_data = {}
                    for key, value in row.items():
                        clean_key = key.strip().lower()
                        if 'lat' in clean_key:
                            bin_data['lat'] = float(value) if value else None
                        elif 'lng' in clean_key or 'lon' in clean_key:
                            bin_data['lng'] = float(value) if value else None
                        elif 'title' in clean_key:
                            bin_data['title'] = value.strip() if value else ''
                        elif 'fill' in clean_key:
                            bin_data['fill'] = int(value) if value else None
                    
                    if len(bin_data) >= 4:  # Has all required fields
                        bins_data.append(bin_data)
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"CSV parsing error: {str(e)}"
                )
        
        if not bins_data:
            raise HTTPException(
                status_code=400,
                detail="No valid bin data found in file"
            )
        
        # Import bins with validation
        result = bin_crud.create_bulk(db, bins_data)
        
        # Construct response message
        message_parts = []
        if result.success_count > 0:
            message_parts.append(f"Successfully processed {result.success_count} bins")
        if result.skipped_count > 0:
            message_parts.append(f"skipped {result.skipped_count} invalid entries")
        
        message = ". ".join(message_parts) + "."
        
        return FileUploadResponse(
            message=message,
            results=result
        )
        
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="File encoding error. Please use UTF-8 encoded files."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Upload processing error: {str(e)}"
        )