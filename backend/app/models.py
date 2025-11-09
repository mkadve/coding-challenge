from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class EventCategory(Base):
    __tablename__ = "event_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    timeslots: Mapped[list["TimeSlot"]] = relationship(
        back_populates="category", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<EventCategory id={self.id} name={self.name!r}>"


class TimeSlot(Base):
    __tablename__ = "time_slots"
    __table_args__ = (
        UniqueConstraint(
            "category_id",
            "start_time",
            "end_time",
            name="uq_timeslot_category_time",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("event_categories.id"), nullable=False, index=True
    )
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    category: Mapped[EventCategory] = relationship(back_populates="timeslots")
    booking: Mapped["Booking | None"] = relationship(
        back_populates="slot", cascade="all, delete-orphan", uselist=False
    )

    def __repr__(self) -> str:
        return (
            f"<TimeSlot id={self.id} category_id={self.category_id} "
            f"start={self.start_time.isoformat()} end={self.end_time.isoformat()}>"
        )


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    time_slot_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("time_slots.id"),
        unique=True,
        nullable=False,
        index=True,
    )
    user_name: Mapped[str] = mapped_column(String(120), nullable=False)
    user_email: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    booked_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    slot: Mapped[TimeSlot] = relationship(back_populates="booking")

    def __repr__(self) -> str:
        return (
            f"<Booking time_slot_id={self.time_slot_id} "
            f"user_email={self.user_email!r}>"
        )
