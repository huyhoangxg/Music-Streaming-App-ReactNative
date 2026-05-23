export type RecommendationContextType = 'home_feed' | 'autoplay' | 'similar_tracks';

export interface GenreScore {
  name: string;
  score: number;
}

export interface AnalyzeSongGenreRequestPayload {
  songId: string;
  audioUrl: string;
  title?: string;
}

export interface AnalyzeSongGenreResponsePayload {
  songId: string;
  primaryGenre: string | null;
  genres: GenreScore[];
  confidence: number | null;
  status: 'success' | 'failed';
  modelVersion?: string | null;
  errorMessage?: string | null;
}

export interface ProfileInteractionSignal {
  songId: string;
  artistId: string;
  genres: string[];
  completionRate?: number;
  durationPlayed?: number;
  liked?: boolean;
  reposted?: boolean;
  addedToPlaylist?: boolean;
  followedCreator?: boolean;
  playedAt?: string;
}

export interface GenreAffinity {
  name: string;
  score: number;
}

export interface ArtistAffinity {
  artistId: string;
  score: number;
}

export interface TasteProfileBuildRequestPayload {
  userId: string;
  interactions: ProfileInteractionSignal[];
}

export interface TasteProfileBuildResponsePayload {
  userId: string;
  topGenres: GenreAffinity[];
  topArtists: ArtistAffinity[];
  activityScore: number;
  updatedAt: string;
}

export interface RecommendationCandidate {
  songId: string;
  title: string;
  artistId: string;
  finalPrimaryGenre?: string | null;
  uploaderGenre?: string | null;
  aiPrimaryGenre?: string | null;
  aiGenres?: GenreScore[];
  genres: string[];
  tags: string[];
  popularityScore: number;
  freshnessScore: number;
  collaborativeScore: number;
}

export interface RecommendationRequestPayload {
  userId: string;
  contextType: RecommendationContextType;
  limit?: number;
  seedSongId?: string;
  seedGenres?: string[];
  seedArtistId?: string | null;
  preferDifferentArtist?: boolean;
  recentSongIds?: string[];
  userProfile: TasteProfileBuildResponsePayload;
  candidates: RecommendationCandidate[];
}

export interface RecommendationItemPayload {
  songId: string;
  contentScore: number;
  collaborativeScore: number;
  popularityScore: number;
  freshnessScore: number;
  finalScore: number;
  reasons: string[];
}

export interface RecommendationResponsePayload {
  userId: string;
  contextType: RecommendationContextType;
  strategy: string;
  generatedAt: string;
  items: RecommendationItemPayload[];
}
