export const Role = {
  USER: "USER",
  MODERATOR: "MODERATOR",
  ADMIN: "ADMIN",
} as const;

export type AppRole = (typeof Role)[keyof typeof Role];

export const ROLE_VALUES: AppRole[] = [Role.USER, Role.MODERATOR, Role.ADMIN];
