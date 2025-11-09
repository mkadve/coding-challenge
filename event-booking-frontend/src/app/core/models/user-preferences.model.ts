export interface UserPreferences {
  displayName: string;
  email: string;
  categoryIds: number[];
}

export const defaultUserPreferences: UserPreferences = {
  displayName: '',
  email: '',
  categoryIds: []
};
