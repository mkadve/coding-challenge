import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import {
  UserPreferences,
  defaultUserPreferences
} from '../models/user-preferences.model';

@Injectable({
  providedIn: 'root'
})
export class PreferencesService {
  private readonly storageKey = 'event-booking-preferences';
  private readonly preferencesSubject =
    new BehaviorSubject<UserPreferences>(defaultUserPreferences);

  readonly preferences$: Observable<UserPreferences> =
    this.preferencesSubject.asObservable();

  constructor() {
    const stored = this.loadFromStorage();
    if (stored) {
      this.preferencesSubject.next(stored);
    }
  }

  get snapshot(): UserPreferences {
    return this.preferencesSubject.value;
  }

  update(preferences: UserPreferences): void {
    const sanitized = this.sanitize(preferences);
    this.preferencesSubject.next(sanitized);
    this.saveToStorage(sanitized);
  }

  clear(): void {
    this.preferencesSubject.next(defaultUserPreferences);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(this.storageKey);
    }
  }

  private sanitize(preferences: UserPreferences): UserPreferences {
    const uniqueCategoryIds = Array.from(new Set(preferences.categoryIds)).sort(
      (a, b) => a - b
    );
    return {
      displayName: preferences.displayName.trim(),
      email: preferences.email.trim().toLowerCase(),
      categoryIds: uniqueCategoryIds
    };
  }

  private loadFromStorage(): UserPreferences | null {
    if (typeof window === 'undefined') {
      return null;
    }
    const raw = window.localStorage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as UserPreferences;
      return this.sanitize({ ...defaultUserPreferences, ...parsed });
    } catch (error) {
      console.warn('Failed to parse stored user preferences', error);
      return null;
    }
  }

  private saveToStorage(preferences: UserPreferences): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(
      this.storageKey,
      JSON.stringify(preferences)
    );
  }
}
