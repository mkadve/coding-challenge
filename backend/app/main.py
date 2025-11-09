from __future__ import annotations

from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine, get_session
from .models import Booking, EventCategory, TimeSlot
from .schemas import (
    BookingCancel,
    BookingCreate,
    BookingRead,
    CategoryRead,
    TimeSlotCreate,
    TimeSlotRead,
)

app = FastAPI(title="Event Booking API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://127.0.0.1:4200",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SessionDep = Annotated[Session, Depends(get_session)]


def init_database() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        existing = session.execute(select(EventCategory)).scalars().all()
        if existing:
            return
        session.add_all(
            [
                EventCategory(name="Cat 1"),
                EventCategory(name="Cat 2"),
                EventCategory(name="Cat 3"),
            ]
        )
        session.commit()


@app.on_event("startup")
def on_startup() -> None:
    init_database()


@app.get("/health", tags=["meta"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/categories", response_model=list[CategoryRead], tags=["categories"])
def list_categories(session: SessionDep) -> list[CategoryRead]:
    categories = (
        session.execute(select(EventCategory).order_by(EventCategory.id))
        .scalars()
        .all()
    )
    return [CategoryRead.model_validate(category) for category in categories]


@app.post(
    "/timeslots",
    response_model=TimeSlotRead,
    status_code=status.HTTP_201_CREATED,
    tags=["timeslots"],
)
def create_time_slot(payload: TimeSlotCreate, session: SessionDep) -> TimeSlotRead:
    category = session.get(EventCategory, payload.category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found.",
        )

    if payload.end_time <= payload.start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be after the start time.",
        )

    overlapping = (
        session.execute(
            select(TimeSlot).where(
                and_(
                    TimeSlot.category_id == payload.category_id,
                    or_(
                        and_(
                            payload.start_time >= TimeSlot.start_time,
                            payload.start_time < TimeSlot.end_time,
                        ),
                        and_(
                            payload.end_time > TimeSlot.start_time,
                            payload.end_time <= TimeSlot.end_time,
                        ),
                        and_(
                            payload.start_time <= TimeSlot.start_time,
                            payload.end_time >= TimeSlot.end_time,
                        ),
                    ),
                )
            )
        )
        .scalars()
        .first()
    )

    if overlapping:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A timeslot already exists for the selected time range.",
        )

    slot = TimeSlot(
        category_id=payload.category_id,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )
    session.add(slot)
    session.commit()
    session.refresh(slot)
    return TimeSlotRead.model_validate(slot)


@app.get("/timeslots", response_model=list[TimeSlotRead], tags=["timeslots"])
def list_time_slots(
    session: SessionDep,
    start_date: Annotated[str, Query(description="Start date in YYYY-MM-DD format")],
    end_date: Annotated[str, Query(description="End date in YYYY-MM-DD format")],
    category_ids: Annotated[str | None, Query(description="Comma separated category ids")] = None,
) -> list[TimeSlotRead]:
    if not start_date or not end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date and end date are required.",
        )

    try:
        start_dt = datetime.fromisoformat(start_date)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid start_date format. Use YYYY-MM-DD.",
        ) from exc

    try:
        end_dt = datetime.fromisoformat(end_date)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid end_date format. Use YYYY-MM-DD.",
        ) from exc

    if end_dt < start_dt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must not be earlier than start_date.",
        )

    # Expand to cover entire days
    end_dt_inclusive = end_dt + timedelta(days=1)

    query = select(TimeSlot).where(
        and_(
            TimeSlot.start_time >= start_dt,
            TimeSlot.start_time < end_dt_inclusive,
        )
    )

    if category_ids:
        try:
            ids = [int(part) for part in category_ids.split(",") if part.strip()]
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="category_ids must contain integers.",
            ) from exc
        if ids:
            query = query.where(TimeSlot.category_id.in_(ids))

    slots = session.execute(query.order_by(TimeSlot.start_time)).scalars().all()
    return [TimeSlotRead.model_validate(slot) for slot in slots]


@app.post(
    "/timeslots/{slot_id}/book",
    response_model=BookingRead,
    status_code=status.HTTP_201_CREATED,
    tags=["bookings"],
)
def book_time_slot(
    slot_id: int,
    payload: BookingCreate,
    session: SessionDep,
) -> BookingRead:
    slot = session.get(TimeSlot, slot_id)
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time slot not found.",
        )

    if slot.booking:
        if slot.booking.user_email.lower() == payload.user_email.lower():
            return BookingRead.model_validate(slot.booking)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This time slot is already booked.",
        )

    booking = Booking(
        time_slot_id=slot.id,
        user_name=payload.user_name.strip(),
        user_email=payload.user_email.lower().strip(),
    )
    session.add(booking)
    session.commit()
    session.refresh(booking)
    return BookingRead.model_validate(booking)


@app.post(
    "/timeslots/{slot_id}/cancel",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["bookings"],
)
def cancel_booking(slot_id: int, payload: BookingCancel, session: SessionDep) -> None:
    slot = session.get(TimeSlot, slot_id)
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time slot not found.",
        )

    if not slot.booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No booking found for this time slot.",
        )

    if slot.booking.user_email.lower() != payload.user_email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the original attendee can cancel this booking.",
        )

    session.delete(slot.booking)
    session.commit()
