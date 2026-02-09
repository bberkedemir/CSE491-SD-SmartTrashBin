# Smart Waste Backend

FastAPI backend for managing smart waste bin locations and fill levels.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up PostgreSQL database:
```sql
CREATE DATABASE smart_waste_db;
```

3. Update `.env` file with your database credentials.

4. Run the server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

- `GET /api/v1/bins` - List all bins
- `POST /api/v1/bins` - Create new bin
- `GET /api/v1/bins/{id}` - Get specific bin
- `PUT /api/v1/bins/{id}` - Update bin
- `DELETE /api/v1/bins/{id}` - Delete bin

## API Documentation

Visit `http://localhost:8000/docs` for interactive API documentation.