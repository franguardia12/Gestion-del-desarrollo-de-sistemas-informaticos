/// <reference types="vite/client" />

const DEFAULT_API_BASE = "http://localhost:8000";

export const API_BASE =
  typeof import.meta.env.VITE_API_BASE === "string" && import.meta.env.VITE_API_BASE.length > 0
    ? import.meta.env.VITE_API_BASE
    : DEFAULT_API_BASE;

type QueryValue = string | number | boolean | null | undefined;

export function buildApiUrl(path: string, params?: Record<string, QueryValue>) {
  const url = new URL(path, API_BASE);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }
  return url;
}

export async function fetchJson<T>(input: string | URL, init?: RequestInit): Promise<T> {
  const finalInit: RequestInit = {
        ...init, // Mantiene cualquier otra opción que se haya pasado (como POST, headers, etc.)
        credentials: 'include', // <-- ¡Esto resuelve el error 401!
    };
  const response = await fetch(input instanceof URL ? input.toString() : input, finalInit);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export interface UserAchievement {
  slug: string;
  name: string;
  description?: string | null;
  icon_url?: string | null;
  earned_at?: string | null;
}

export interface UserReview {
  id: number;
  place_id: number;
  place_name: string;
  author_id: number;
  rating: number;
  title?: string | null;
  comment?: string | null;
  created_at: string;
  helpful_votes: number;
  not_helpful_votes: number;
  user_vote?: "helpful" | "not_helpful" | null;
  place_rating_avg?: number | null;
  place_photo_url?: string | null;
}

export interface PlaceReview {
  id: number;
  place_id: number;
  author_id: number;
  rating: number;
  title?: string | null;
  comment?: string | null;
  photos: string[];
  author_name: string;
  author_photo_url: string;
  created_at: string;
  place_name?: string | null;
  helpful_votes: number;
  not_helpful_votes: number;
  user_vote?: "helpful" | "not_helpful" | null;
  place_rating_avg?: number | null;
  place_photo_url?: string | null;
  // Owner reply fields
  reply_text?: string | null;
  reply_created_at?: string | null;
  reply_updated_at?: string | null;
}

export interface UserProfile {
  username: string;
  full_name?: string | null;
  age?: number | null;
  city?: string | null;
  country?: string | null;
  joined_in?: string | null;
  photo_url: string;
  bio?: string | null;
  is_owner: boolean;
  stats: {
    reviews_count: number;
    achievements_count: number;
  };
  achievements: UserAchievement[];
  reviews: UserReview[];
}

export interface CreateReviewPayload {
  place_id: number;
  rating: number;
  title: string;
  comment: string;
}

export interface CreateReviewResponse {
  id: number;
  place_id: number;
  author_id: number;
  rating: number;
  title?: string | null;
  comment?: string | null;
  photos: string[];
  author_name: string;
  author_photo_url: string;
  created_at: string;
  place_name: string;
  place_rating_avg?: number | null;
  place_photo_url?: string | null;
  helpful_votes: number;
  not_helpful_votes: number;
  user_vote?: "helpful" | "not_helpful" | null;
}

export async function createReview(payload: CreateReviewPayload): Promise<CreateReviewResponse> {
  return fetchJson<CreateReviewResponse>(buildApiUrl("/api/reviews"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
}

export type UpdateReviewPayload = CreateReviewPayload;

export async function updateReview(
  reviewId: number,
  payload: UpdateReviewPayload
): Promise<CreateReviewResponse> {
  return fetchJson<CreateReviewResponse>(buildApiUrl(`/api/reviews/${reviewId}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
}

export async function deleteReview(reviewId: number): Promise<void> {
  const response = await fetch(buildApiUrl(`/api/reviews/${reviewId}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "No se pudo eliminar la reseña");
  }
}

export async function createReviewReply(reviewId: number, replyText: string) {
  return fetchJson<{ id: number; reply_text: string; reply_created_at?: string; reply_updated_at?: string }>(
    buildApiUrl(`/api/reviews/${reviewId}/reply`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ reply_text: replyText }),
    }
  );
}

export async function updateReviewReply(reviewId: number, replyText: string) {
  return fetchJson<{ id: number; reply_text: string; reply_created_at?: string; reply_updated_at?: string }>(
    buildApiUrl(`/api/reviews/${reviewId}/reply`),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ reply_text: replyText }),
    }
  );
}

export async function deleteReviewReply(reviewId: number) {
  const response = await fetch(buildApiUrl(`/api/reviews/${reviewId}/reply`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "No se pudo eliminar la respuesta");
  }
}

export async function fetchUserProfile(username: string): Promise<UserProfile> {
  return fetchJson<UserProfile>(buildApiUrl(`/api/users/${username}`));
}

export type ChatbotAIRole = "user" | "assistant";

export interface ChatbotAIMessage {
  role: ChatbotAIRole;
  content: string;
}

export interface RecommendedPlace {
  id?: number | null;
  name: string;
  category?: string | null;
}

export interface AssistantState {
  pending_intent?: "travel_recommendation";
  travel_preferences?: Record<string, unknown>;
  recommended_places?: RecommendedPlace[];
  last_category?: string | null;
}

export interface ChatbotAIReply {
  message: string;
  state?: AssistantState | null;
}

interface ChatbotAIOptions {
  state?: AssistantState | null;
  userName?: string;
}

export async function fetchChatbotAIResponse(
  messages: ChatbotAIMessage[],
  options?: ChatbotAIOptions
): Promise<ChatbotAIReply> {
  return fetchJson<ChatbotAIReply>(buildApiUrl("/api/chatbot/ai/respond"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      messages,
      state: options?.state ?? null,
      user_name: options?.userName ?? null,
    }),
  });
}

export interface UpdateProfilePayload {
  full_name?: string;
  bio?: string;
  is_owner?: boolean;
  avatar?: File;
}

export async function updateMyProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
  const formData = new FormData();

  if (payload.full_name !== undefined) {
    formData.append("full_name", payload.full_name);
  }

  if (payload.bio !== undefined) {
    formData.append("bio", payload.bio);
  }

  if (payload.is_owner !== undefined) {
    formData.append("is_owner", String(payload.is_owner));
  }

  if (payload.avatar) {
    formData.append("avatar", payload.avatar);
  }

  const response = await fetch(buildApiUrl("/api/users/me"), {
    method: "PATCH",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const text = await response.text();
    try {
      const errorData = JSON.parse(text);
      if (errorData.detail) {
        if (Array.isArray(errorData.detail)) {
          const messages = errorData.detail.map((item: any) => item.msg ?? item.detail);
          throw new Error(messages.filter(Boolean).join(", ") || "No se pudo actualizar el perfil");
        }
        throw new Error(errorData.detail);
      }
    } catch {
      if (text) {
        throw new Error(text);
      }
    }

    throw new Error(`No se pudo actualizar el perfil (estado ${response.status})`);
  }

  return response.json();
}

export type ReviewVoteAction = "helpful" | "not_helpful" | "clear";

export interface ReviewVoteResponse {
  review_id: number;
  helpful_votes: number;
  not_helpful_votes: number;
  user_vote?: "helpful" | "not_helpful" | null;
}

export async function voteReview(
  reviewId: number,
  vote: ReviewVoteAction
): Promise<ReviewVoteResponse> {
  return fetchJson<ReviewVoteResponse>(buildApiUrl(`/api/reviews/${reviewId}/vote`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ vote }),
  });
}

export async function deletePlace(placeId: number): Promise<void> {
  const response = await fetch(buildApiUrl(`/api/places/${placeId}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "No se pudo eliminar el establecimiento");
  }
}

// Auth types and functions
export interface AuthUser {
  id: number;
  username: string;
  email: string;
  full_name?: string | null;
  is_owner: boolean;
}

export interface AuthResponse {
  message: string;
  user: AuthUser;
}

export async function signup(
  username: string,
  email: string,
  password: string,
  full_name?: string,
  is_owner?: boolean
): Promise<AuthResponse> {
  const response = await fetch(buildApiUrl("/api/auth/signup"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, email, password, full_name, is_owner }),
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMessage = text || `Signup failed with status ${response.status}`;

    try {
      const errorData = JSON.parse(text);
      if (errorData.detail) {
        // Check if detail is an array (422 validation errors)
        if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map((err: any) => err.msg).join(", ");
        } else if (typeof errorData.detail === "string") {
          errorMessage = errorData.detail;
        }
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch (parseError) {
      // If JSON parsing fails, use the text as-is
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(buildApiUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMessage = text || `Login failed with status ${response.status}`;

    try {
      const errorData = JSON.parse(text);
      if (errorData.detail) {
        // Check if detail is an array (422 validation errors)
        if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map((err: any) => err.msg).join(", ");
        } else if (typeof errorData.detail === "string") {
          errorMessage = errorData.detail;
        }
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch (parseError) {
      // If JSON parsing fails, use the text as-is
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

export async function logout(): Promise<void> {
  await fetch(buildApiUrl("/api/auth/logout"), {
    method: "POST",
    credentials: "include",
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const response = await fetch(buildApiUrl("/api/auth/me"), {
      credentials: "include",
    });

    if (!response.ok) {
      return null;
    }

    const data: AuthResponse = await response.json();
    return data.user;
  } catch {
    return null;
  }
}
