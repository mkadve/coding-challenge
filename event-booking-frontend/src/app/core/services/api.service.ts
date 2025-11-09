import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { EventCategory } from '../models/event-category.model';
import { TimeSlot } from '../models/time-slot.model';
import { Booking } from '../models/booking.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  constructor(private readonly http: HttpClient) {}

  getCategories(): Observable<EventCategory[]> {
    return this.http
      .get<EventCategory[]>(this.buildUrl('/categories'))
      .pipe(catchError((error) => this.handleError(error, 'fetch categories')));
  }

  getTimeSlots(params: TimeSlotQueryParams): Observable<TimeSlot[]> {
    let httpParams = new HttpParams()
      .set('start_date', params.startDate)
      .set('end_date', params.endDate);

    if (params.categoryIds?.length) {
      httpParams = httpParams.set(
        'category_ids',
        params.categoryIds.join(',')
      );
    }

    if (params.includeEmpty !== undefined) {
      httpParams = httpParams.set(
        'include_empty',
        String(params.includeEmpty)
      );
    }

    return this.http
      .get<TimeSlot[]>(this.buildUrl('/timeslots'), { params: httpParams })
      .pipe(catchError((error) => this.handleError(error, 'fetch timeslots')));
  }

  createTimeSlot(payload: CreateTimeSlotRequest): Observable<TimeSlot> {
    return this.http
      .post<TimeSlot>(this.buildUrl('/timeslots'), payload)
      .pipe(catchError((error) => this.handleError(error, 'create timeslot')));
  }

  bookTimeSlot(
    slotId: number,
    payload: BookTimeSlotRequest
  ): Observable<Booking> {
    return this.http
      .post<Booking>(this.buildUrl(`/timeslots/${slotId}/book`), payload)
      .pipe(catchError((error) => this.handleError(error, 'book timeslot')));
  }

  cancelBooking(
    slotId: number,
    payload: CancelBookingRequest
  ): Observable<void> {
    return this.http
      .post<void>(this.buildUrl(`/timeslots/${slotId}/cancel`), payload)
      .pipe(catchError((error) => this.handleError(error, 'cancel booking')));
  }

  private buildUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private handleError(error: HttpErrorResponse, action: string) {
    console.error(`Failed to ${action}`, error);
    return throwError(() => error);
  }
}

export interface TimeSlotQueryParams {
  startDate: string;
  endDate: string;
  categoryIds?: number[];
  includeEmpty?: boolean;
}

export interface CreateTimeSlotRequest {
  category_id: number;
  start_time: string;
  end_time: string;
}

export interface BookTimeSlotRequest {
  user_name: string;
  user_email: string;
}

export interface CancelBookingRequest {
  user_email: string;
}
