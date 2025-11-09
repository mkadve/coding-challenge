import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatOptionModule } from '@angular/material/core';
import { Subject, finalize, takeUntil } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { EventCategory } from '../../core/models/event-category.model';
import { TimeSlot } from '../../core/models/time-slot.model';
import { PreferencesService } from '../../core/services/preferences.service';
import { UserPreferences } from '../../core/models/user-preferences.model';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

interface CalendarDay {
  date: Date;
  label: string;
  fullLabel: string;
  slots: TimeSlot[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatOptionModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    RouterLink
  ],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarComponent implements OnInit, OnDestroy {
  categories: EventCategory[] = [];
  calendarDays: CalendarDay[] = [];
  isLoadingCategories = false;
  isLoadingSlots = false;
  pendingSlotIds = new Set<number>();

  currentWeekStart = this.startOfWeek(new Date());
  weekRangeLabel = '';

  preferencesCategoryIds: number[] = [];
  activeCategoryIds: number[] = [];
  currentPreferences: UserPreferences;

  private categoriesLoaded = false;
  private readonly destroy$ = new Subject<void>();
  private readonly dayHeaderFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
  private readonly dayFullFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
  private readonly timeRangeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
  private readonly todayWeekStart = this.startOfWeek(new Date());

  constructor(
    private readonly apiService: ApiService,
    private readonly preferencesService: PreferencesService,
    private readonly snackBar: MatSnackBar
  ) {
    this.currentPreferences = this.preferencesService.snapshot;
  }

  ngOnInit(): void {
    this.updateWeekRangeLabel();
    this.loadCategories();

    this.preferencesService.preferences$
      .pipe(takeUntil(this.destroy$))
      .subscribe((prefs) => {
        this.currentPreferences = prefs;
        this.preferencesCategoryIds = prefs.categoryIds;
        this.syncActiveCategoriesWithPreferences();
        if (this.categoriesLoaded) {
          this.loadTimeSlots();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get hasPreferences(): boolean {
    return this.preferencesCategoryIds.length > 0;
  }

  get preferredCategories(): EventCategory[] {
    const preferredSet = new Set(this.preferencesCategoryIds);
    return this.categories.filter((category) => preferredSet.has(category.id));
  }

  get isCurrentWeek(): boolean {
    return (
      this.currentWeekStart.getTime() === this.todayWeekStart.getTime()
    );
  }

  onCategoryFilterChange(categoryIds: number[]): void {
    const sanitized = categoryIds.filter((id) =>
      this.preferencesCategoryIds.includes(id)
    );

    this.activeCategoryIds = sanitized;
    this.loadTimeSlots();
  }

  changeWeek(offset: number): void {
    this.currentWeekStart = new Date(
      this.currentWeekStart.getTime() + offset * 7 * DAY_IN_MILLISECONDS
    );
    this.updateWeekRangeLabel();
    this.loadTimeSlots();
  }

  goToCurrentWeek(): void {
    this.currentWeekStart = this.startOfWeek(new Date());
    this.updateWeekRangeLabel();
    this.loadTimeSlots();
  }

  bookSlot(slot: TimeSlot): void {
    if (this.isActionDisabled(slot)) {
      return;
    }

    if (!this.currentPreferences.displayName.trim() || !this.currentPreferences.email.trim()) {
      this.showMessage('Please set your name and email in Preferences before booking.');
      return;
    }

    this.pendingSlotIds.add(slot.id);
    this.apiService
      .bookTimeSlot(slot.id, {
        user_name: this.currentPreferences.displayName,
        user_email: this.currentPreferences.email
      })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.pendingSlotIds.delete(slot.id))
      )
      .subscribe({
        next: () => {
          this.showMessage('Booking confirmed.');
          this.loadTimeSlots();
        },
        error: (error) => {
          const message =
            error?.error?.detail ??
            'Unable to complete the booking. Please try again.';
          this.showMessage(message);
        }
      });
  }

  cancelBooking(slot: TimeSlot): void {
    if (this.isActionDisabled(slot)) {
      return;
    }

    if (!slot.booking) {
      return;
    }

    if (!this.currentPreferences.email.trim()) {
      this.showMessage('Missing email in preferences. Unable to cancel booking.');
      return;
    }

    this.pendingSlotIds.add(slot.id);
    this.apiService
      .cancelBooking(slot.id, {
        user_email: this.currentPreferences.email
      })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.pendingSlotIds.delete(slot.id))
      )
      .subscribe({
        next: () => {
          this.showMessage('Booking cancelled.');
          this.loadTimeSlots();
        },
        error: (error) => {
          const message =
            error?.error?.detail ??
            'Unable to cancel the booking. Please try again.';
          this.showMessage(message);
        }
      });
  }

  isBooked(slot: TimeSlot): boolean {
    return !!slot.booking;
  }

  isBookedByCurrentUser(slot: TimeSlot): boolean {
    if (!slot.booking) {
      return false;
    }

    const emailMatches =
      !!this.currentPreferences.email &&
      slot.booking.user_email.toLowerCase() ===
        this.currentPreferences.email.toLowerCase();
    const nameMatches =
      !!this.currentPreferences.displayName &&
      !this.currentPreferences.email &&
      slot.booking.user_name.toLowerCase() ===
        this.currentPreferences.displayName.toLowerCase();

    return emailMatches || nameMatches;
  }

  isActionDisabled(slot: TimeSlot): boolean {
    return this.pendingSlotIds.has(slot.id);
  }

  formatTimeRange(slot: TimeSlot): string {
    const start = new Date(slot.start_time);
    const end = new Date(slot.end_time);
    return `${this.timeRangeFormatter.format(start)} – ${this.timeRangeFormatter.format(end)}`;
  }

  trackByDay = (_: number, day: CalendarDay) => day.date.toISOString();
  trackBySlot = (_: number, slot: TimeSlot) => slot.id;

  private loadCategories(): void {
    this.isLoadingCategories = true;
    this.apiService
      .getCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          this.categories = categories;
          this.categoriesLoaded = true;
          this.syncActiveCategoriesWithPreferences();
          this.isLoadingCategories = false;
          this.loadTimeSlots();
        },
        error: () => {
          this.isLoadingCategories = false;
          this.showMessage(
            'Unable to load categories. Calendar data may be incomplete.'
          );
        }
      });
  }

  private loadTimeSlots(): void {
    if (!this.categoriesLoaded) {
      return;
    }

    if (!this.activeCategoryIds.length) {
      this.calendarDays = this.buildEmptyCalendar();
      return;
    }

    const startDate = this.toISODate(this.currentWeekStart);
    const endDate = this.toISODate(
      new Date(this.currentWeekStart.getTime() + 6 * DAY_IN_MILLISECONDS)
    );

    this.isLoadingSlots = true;
    this.apiService
      .getTimeSlots({
        startDate,
        endDate,
        categoryIds: this.activeCategoryIds
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (slots) => {
          this.calendarDays = this.buildCalendarDays(slots);
          this.isLoadingSlots = false;
        },
        error: () => {
          this.isLoadingSlots = false;
          this.calendarDays = this.buildEmptyCalendar();
          this.showMessage('Failed to load time slots for the selected week.');
        }
      });
  }

  private syncActiveCategoriesWithPreferences(): void {
    if (!this.categoriesLoaded) {
      return;
    }

    const validPreferenceIds = this.preferencesCategoryIds.filter((id) =>
      this.categories.some((category) => category.id === id)
    );
    this.preferencesCategoryIds = validPreferenceIds;

    if (!this.activeCategoryIds.length) {
      this.activeCategoryIds = [...validPreferenceIds];
    } else {
      this.activeCategoryIds = this.activeCategoryIds.filter((id) =>
        validPreferenceIds.includes(id)
      );
    }

    if (this.activeCategoryIds.length === 0) {
      this.activeCategoryIds = [...validPreferenceIds];
    }
  }

  private buildCalendarDays(slots: TimeSlot[]): CalendarDay[] {
    const days = this.buildEmptyCalendar();
    const dayMap = new Map<string, CalendarDay>();
    days.forEach((day) => dayMap.set(this.toISODate(day.date), day));

    const sortedSlots = [...slots].sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    sortedSlots.forEach((slot) => {
      const dayKey = this.toISODate(new Date(slot.start_time));
      const day = dayMap.get(dayKey);
      if (day) {
        day.slots.push(slot);
      }
    });

    return days;
  }

  private buildEmptyCalendar(): CalendarDay[] {
    const days: CalendarDay[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const date = new Date(
        this.currentWeekStart.getTime() + offset * DAY_IN_MILLISECONDS
      );
      days.push({
        date,
        label: this.dayHeaderFormatter.format(date),
        fullLabel: this.dayFullFormatter.format(date),
        slots: []
      });
    }
    return days;
  }

  private startOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private toISODate(date: Date): string {
    return date.toISOString().split('T')[0]!;
  }

  private updateWeekRangeLabel(): void {
    const endDate = new Date(
      this.currentWeekStart.getTime() + 6 * DAY_IN_MILLISECONDS
    );
    const formatter = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric'
    });

    this.weekRangeLabel = `${formatter.format(this.currentWeekStart)} – ${formatter.format(
      endDate
    )}`;
  }

  private showMessage(message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: 3500
    });
  }
}
