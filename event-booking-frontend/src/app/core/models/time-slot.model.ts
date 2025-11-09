import { EventCategory } from './event-category.model';
import { Booking } from './booking.model';

export interface TimeSlot {
  id: number;
  category: EventCategory;
  start_time: string;
  end_time: string;
  booking?: Booking | null;
}
