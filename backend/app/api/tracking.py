import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth_dependency import get_current_user, get_current_admin_user
from app.models.user import User
from app.models.token_blacklist import TokenBlacklist
from app.services.auth_service import AuthService
from app.schemas.tracking import (
    ActiveSession,
    CompleteSessionRequest,
    PositionUpdateRequest,
    SessionsResponse,
    StartSessionRequest,
    WSMessage,
)

logger = logging.getLogger("tracking.api")
router = APIRouter()

# In-memory stores — keyed by driver user_id
_sessions: Dict[int, ActiveSession] = {}
_ws_connections: List[WebSocket] = []


async def _broadcast(message: WSMessage) -> None:
    dead: List[WebSocket] = []
    payload = message.model_dump_json()
    for ws in _ws_connections:
        try:
            await ws.send_text(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _ws_connections.remove(ws)


@router.post("/start", status_code=201)
async def start_session(
    payload: StartSessionRequest,
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    session = ActiveSession(
        driver_id=current_user.id,
        driver_name=current_user.username,
        driver_full_name=current_user.full_name,
        lat=payload.current_lat,
        lng=payload.current_lng,
        route_stops=payload.route_stops,
        route_geometry=payload.route_geometry,
        current_stop_index=0,
        collected_ids=[],
        skipped_ids=[],
        started_at=now,
        last_update=now,
        is_completed=False,
    )
    _sessions[current_user.id] = session
    logger.info(f"[TRACKING] Session started: driver={current_user.username} (id={current_user.id})")
    await _broadcast(WSMessage(event="session_started", session=session))
    return {"status": "started", "driver_id": current_user.id}


@router.put("/position")
async def update_position(
    payload: PositionUpdateRequest,
    current_user: User = Depends(get_current_user),
):
    if current_user.id not in _sessions:
        raise HTTPException(status_code=404, detail="No active session. Call /tracking/start first.")

    session = _sessions[current_user.id]
    session.lat = payload.lat
    session.lng = payload.lng
    session.current_stop_index = payload.current_stop_index
    session.collected_ids = payload.collected_ids
    session.skipped_ids = payload.skipped_ids
    session.last_update = datetime.now(timezone.utc)

    await _broadcast(WSMessage(event="position_updated", session=session))
    return {"status": "updated"}


@router.post("/complete")
async def complete_session(
    payload: CompleteSessionRequest,
    current_user: User = Depends(get_current_user),
):
    if current_user.id not in _sessions:
        raise HTTPException(status_code=404, detail="No active session found.")

    session = _sessions[current_user.id]
    session.is_completed = True
    session.collected_ids = payload.collected_ids
    session.skipped_ids = payload.skipped_ids
    session.last_update = datetime.now(timezone.utc)

    del _sessions[current_user.id]
    await _broadcast(WSMessage(event="session_completed", session=session))
    logger.info(f"[TRACKING] Session completed: driver={current_user.username}")
    return {"status": "completed"}


@router.get("/sessions", response_model=SessionsResponse)
def get_sessions(current_user: User = Depends(get_current_user)):
    sessions_list = list(_sessions.values())
    return SessionsResponse(sessions=sessions_list, count=len(sessions_list))


@router.delete("/sessions/{driver_id}")
async def cancel_session(
    driver_id: int,
    current_user: User = Depends(get_current_admin_user),
):
    """Admin cancels an active driver session (e.g. driver closed the app)."""
    if driver_id not in _sessions:
        raise HTTPException(status_code=404, detail="Session not found.")

    session = _sessions[driver_id]
    session.is_completed = True
    session.last_update = datetime.now(timezone.utc)

    del _sessions[driver_id]
    await _broadcast(WSMessage(event="session_completed", session=session))
    logger.info(f"[TRACKING] Session cancelled by admin {current_user.username}: driver_id={driver_id}")
    return {"status": "cancelled", "driver_id": driver_id}


# ── Stale session cleanup ─────────────────────────────────────────────────────
STALE_TIMEOUT_SECONDS = 1800  # 30 minutes — covers closed/backgrounded app


async def cleanup_stale_sessions() -> None:
    """Background task: remove sessions with no GPS update for 5 minutes."""
    while True:
        await asyncio.sleep(60)
        now = datetime.now(timezone.utc)
        stale = [
            s for s in list(_sessions.values())
            if (now - s.last_update).total_seconds() > STALE_TIMEOUT_SECONDS
        ]
        for session in stale:
            session.is_completed = True
            _sessions.pop(session.driver_id, None)
            await _broadcast(WSMessage(event="session_completed", session=session))
            logger.info(
                f"[TRACKING] Stale session auto-removed: driver={session.driver_name} "
                f"(last update {int((now - session.last_update).total_seconds())}s ago)"
            )


@router.websocket("/ws")
async def tracking_websocket(
    websocket: WebSocket,
    token: str = Query(..., description="JWT bearer token"),
    db: Session = Depends(get_db),
):
    payload = AuthService.verify_token(token)
    if payload is None:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    blacklisted = db.query(TokenBlacklist).filter(TokenBlacklist.token == token).first()
    if blacklisted:
        await websocket.close(code=4001, reason="Token revoked")
        return

    user_id = int(payload.get("sub", 0))
    await websocket.accept()
    _ws_connections.append(websocket)
    logger.info(f"[TRACKING/WS] Client connected (user_id={user_id}). Total: {len(_ws_connections)}")

    snapshot = WSMessage(event="full_snapshot", sessions=list(_sessions.values()))
    await websocket.send_text(snapshot.model_dump_json())

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in _ws_connections:
            _ws_connections.remove(websocket)
        logger.info(f"[TRACKING/WS] Client disconnected (user_id={user_id}). Remaining: {len(_ws_connections)}")
