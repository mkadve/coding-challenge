import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'calendar'
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./pages/calendar/calendar.component').then(
        (m) => m.CalendarComponent
      )
  },
  {
    path: 'preferences',
    loadComponent: () =>
      import('./pages/preferences/preferences.component').then(
        (m) => m.PreferencesComponent
      )
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./pages/admin/admin.component').then((m) => m.AdminComponent)
  },
  {
    path: '**',
    redirectTo: 'calendar'
  }
];
