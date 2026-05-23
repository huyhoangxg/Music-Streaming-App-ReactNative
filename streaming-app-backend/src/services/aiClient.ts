import {
  AnalyzeSongGenreRequestPayload,
  AnalyzeSongGenreResponsePayload,
  GenreScore,
  RecommendationRequestPayload,
  RecommendationResponsePayload,
  TasteProfileBuildRequestPayload,
  TasteProfileBuildResponsePayload,
} from '../types/ai';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 180000);

function isGenreScore(value: unknown): value is GenreScore {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<GenreScore>;
  return (
    typeof candidate.name === 'string' &&
    candidate.name.trim().length > 0 &&
    typeof candidate.score === 'number' &&
    Number.isFinite(candidate.score)
  );
}

function parseAnalyzeSongResponse(value: unknown): AnalyzeSongGenreResponsePayload {
  if (!value || typeof value !== 'object') {
    throw new Error('AI analyze response is not a JSON object.');
  }

  const payload = value as Partial<AnalyzeSongGenreResponsePayload>;

  if (typeof payload.songId !== 'string' || payload.songId.trim().length === 0) {
    throw new Error('AI analyze response is missing songId.');
  }

  if (payload.status !== 'success' && payload.status !== 'failed') {
    throw new Error('AI analyze response has an invalid status.');
  }

  const genres = Array.isArray(payload.genres) ? payload.genres.filter(isGenreScore) : [];
  const confidence =
    typeof payload.confidence === 'number' && Number.isFinite(payload.confidence)
      ? payload.confidence
      : null;

  return {
    songId: payload.songId,
    primaryGenre:
      typeof payload.primaryGenre === 'string' && payload.primaryGenre.trim().length > 0
        ? payload.primaryGenre.trim()
        : null,
    genres,
    confidence,
    status: payload.status,
    modelVersion:
      typeof payload.modelVersion === 'string' && payload.modelVersion.trim().length > 0
        ? payload.modelVersion.trim()
        : null,
    errorMessage:
      typeof payload.errorMessage === 'string' && payload.errorMessage.trim().length > 0
        ? payload.errorMessage.trim()
        : null,
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(`${AI_SERVICE_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `AI service request timed out after ${AI_REQUEST_TIMEOUT_MS}ms: ${path}`,
        );
      }

      throw error;
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`AI service error ${response.status}: ${body}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export const aiClient = {
  async healthCheck() {
    return request<{
      status: string;
      service: string;
      version: string;
      environment: string;
      recommendationMode: string;
      essentiaEnabled: boolean;
      essentiaImportOk: boolean;
      modelsDirExists: boolean;
      embeddingModelExists: boolean;
      classifierModelExists: boolean;
      readinessIssues: string[];
    }>('/health');
  },

  async analyzeSongGenre(payload: AnalyzeSongGenreRequestPayload) {
    return analyzeSong(payload);
  },

  async buildTasteProfile(payload: TasteProfileBuildRequestPayload) {
    return request<TasteProfileBuildResponsePayload>('/v1/profile/rebuild', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async rankRecommendations(payload: RecommendationRequestPayload) {
    return request<RecommendationResponsePayload>('/v1/recommend', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

export type AnalyzeSongResponse = AnalyzeSongGenreResponsePayload;

export async function analyzeSong(payload: AnalyzeSongGenreRequestPayload) {
  const response = await request<AnalyzeSongResponse>('/analyze/song', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return parseAnalyzeSongResponse(response);
}
