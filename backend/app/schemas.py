from datetime import datetime

from pydantic import BaseModel, Field


class CategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)


class CategoryRead(CategoryBase):
    id: int

    model_config = {"from_attributes": True}


class TimeSlotCreate(BaseModel):
    category_id: int
    start_time: datetime
    end_time: datetime


class BookingCreate(BaseModel):
    user_name: str = Field(min_length=1, max_length=120)
    user_email: str = Field(min_length=3, max_length=160)


class BookingCancel(BaseModel):
    user_email: str = Field(min_length=3, max_length=160)


class BookingRead(BaseModel):
    id: int
    user_name: str
    user_email: str
    booked_at: datetime

    model_config = {"from_attributes": True}


class TimeSlotRead(BaseModel):
    id: int
    start_time: datetime
    end_time: datetime
    category: CategoryRead
    booking: BookingRead | None = None

    model_config = {"from_attributes": True}
