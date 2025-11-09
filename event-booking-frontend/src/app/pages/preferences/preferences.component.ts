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
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { EventCategory } from '../../core/models/event-category.model';

@Component({
  selector: 'app-preferences',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatSnackBarModule
  ],
  templateUrl: './preferences.component.html',
  styleUrl: './preferences.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PreferencesComponent implements OnInit, OnDestroy {
  readonly form = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', [Validators.email, Validators.maxLength(160)]],
    categoryIds: this.fb.nonNullable.control<number[]>([])
  });

  categories: EventCategory[] = [];
  isLoading = false;
  isSaving = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly apiService: ApiService,
    private readonly preferencesService: PreferencesService,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    const initial = this.preferencesService.snapshot;
    this.form.setValue({
      displayName: initial.displayName,
      email: initial.email,
      categoryIds: initial.categoryIds
    });

    this.loadCategories();

    this.preferencesService.preferences$
      .pipe(takeUntil(this.destroy$))
      .subscribe((prefs) => {
        this.form.patchValue(
          {
            categoryIds: prefs.categoryIds
          },
          { emitEvent: false }
        );
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get displayNameControl() {
    return this.form.controls.displayName;
  }

  get emailControl() {
    return this.form.controls.email;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const value = this.form.getRawValue();

    this.preferencesService.update({
      displayName: value.displayName.trim(),
      email: value.email.trim(),
      categoryIds: value.categoryIds
    });

    this.isSaving = false;
    this.showMessage('Preferences saved');
  }

  reset(): void {
    const saved = this.preferencesService.snapshot;
    this.form.reset({
      displayName: saved.displayName,
      email: saved.email,
      categoryIds: saved.categoryIds
    });
  }

  selectAll(): void {
    if (!this.categories.length) {
      return;
    }

    this.form.controls.categoryIds.setValue(
      this.categories.map((category) => category.id)
    );
  }

  private loadCategories(): void {
    this.isLoading = true;
    this.apiService
      .getCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          this.categories = categories;
          this.clampSelectedCategories();
          this.isLoading = false;
        },
        error: () => {
          this.categories = [];
          this.isLoading = false;
          this.showMessage('Unable to load categories. Please try again.');
        }
      });
  }

  private clampSelectedCategories(): void {
    const validIds = new Set(this.categories.map((category) => category.id));
    const selection = this.form.controls.categoryIds.value.filter((id) =>
      validIds.has(id)
    );
    this.form.controls.categoryIds.setValue(selection);
  }

  private showMessage(message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: 3000
    });
  }
}
