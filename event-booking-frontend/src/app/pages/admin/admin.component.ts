import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatOptionModule } from '@angular/material/core';
import { Subject, takeUntil } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { EventCategory } from '../../core/models/event-category.model';
import { TimeSlot } from '../../core/models/time-slot.model';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

interface AdminTimeSlot extends TimeSlot {
  startDate: Date;
  endDate: Date;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatOptionModule,
    MatInputModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatChipsModule
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminComponent implements OnInit, OnDestroy {
  readonly displayedColumns = ['date', 'time', 'category', 'status', 'booking'];

  categories: EventCategory[] = [];
  timeslots: AdminTimeSlot[] = [];
  categoryFilter: number | 'all' = 'all';

  isLoadingCategories = false;
  isLoadingSlots = false;
  isCreatingSlot = false;

  currentWeekStart = this.startOfWeek(new Date());
  weekRangeLabel = '';

  readonly newSlotForm = this.fb.nonNullable.group({
    categoryId: [null as number | null, Validators.required],
    date: ['', Validators.required],
    startTime: ['', Validators.required],
    endTime: ['', Validators.required]
  });

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly apiService: ApiService,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.updateWeekRangeLabel();
    this.loadCategories();
    this.loadTimeSlots();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get filteredSlots(): AdminTimeSlot[] {
    if (this.categoryFilter === 'all') {
      return this.timeslots;
    }

    return this.timeslots.filter(
      (slot) => slot.category.id === this.categoryFilter
    );
  }

  onCreateSlot(): void {
    if (this.newSlotForm.invalid) {
      this.newSlotForm.markAllAsTouched();
      return;
    }

    const { categoryId, date, startTime, endTime } = this.newSlotForm.getRawValue();
    if (!categoryId || !date || !startTime || !endTime) {
      return;
    }

    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      this.showMessage('Please provide valid start and end times.');
      return;
    }

    if (start >= end) {
      this.showMessage('End time must be after the start time.');
      return;
    }

    this.isCreatingSlot = true;
    this.apiService
      .createTimeSlot({
        category_id: categoryId,
        start_time: start.toISOString(),
        end_time: end.toISOString()
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessage('Time slot created successfully.');
          this.isCreatingSlot = false;
          this.newSlotForm.reset();
          this.loadTimeSlots();
        },
        error: (error) => {
          this.isCreatingSlot = false;
          const message =
            error?.error?.detail ??
            'Failed to create time slot. Please try again.';
          this.showMessage(message);
        }
      });
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

  applyCategoryFilter(filterValue: number | 'all'): void {
    this.categoryFilter = filterValue;
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  formatTimeRange(slot: AdminTimeSlot): string {
    const formatter = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    });
    return `${formatter.format(slot.startDate)} – ${formatter.format(
      slot.endDate
    )}`;
  }

  private loadCategories(): void {
    this.isLoadingCategories = true;
    this.apiService
      .getCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          this.categories = categories;
          this.isLoadingCategories = false;
        },
        error: () => {
          this.isLoadingCategories = false;
          this.showMessage('Unable to load categories.');
        }
      });
  }

  private loadTimeSlots(): void {
    const startDate = this.toISODate(this.currentWeekStart);
    const endDate = this.toISODate(
      new Date(this.currentWeekStart.getTime() + 6 * DAY_IN_MILLISECONDS)
    );

    this.isLoadingSlots = true;
    this.apiService
      .getTimeSlots({
        startDate,
        endDate
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (slots) => {
          this.timeslots = slots
            .map((slot) => ({
              ...slot,
              startDate: new Date(slot.start_time),
              endDate: new Date(slot.end_time)
            }))
            .sort(
              (a, b) => a.startDate.getTime() - b.startDate.getTime()
            );
          this.isLoadingSlots = false;
        },
        error: () => {
          this.isLoadingSlots = false;
          this.timeslots = [];
          this.showMessage('Failed to load time slots for the selected range.');
        }
      });
  }

  private updateWeekRangeLabel(): void {
    const formatter = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric'
    });
    const endDate = new Date(
      this.currentWeekStart.getTime() + 6 * DAY_IN_MILLISECONDS
    );
    this.weekRangeLabel = `${formatter.format(this.currentWeekStart)} – ${formatter.format(
      endDate
    )}`;
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

  private showMessage(message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: 3500
    });
  }
}
