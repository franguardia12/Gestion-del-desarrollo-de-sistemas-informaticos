const STORAGE_KEY = "vx-current-username";
const FALLBACK_USERNAME = "viajera_lu";

export function getCurrentUserUsername(): string {
  if (typeof window !== "undefined" && window.localStorage) {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && stored.trim().length > 0) {
      return stored.trim();
    }
  }
  return FALLBACK_USERNAME;
}

export function setCurrentUserUsername(username: string) {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY, username);
  }
}
