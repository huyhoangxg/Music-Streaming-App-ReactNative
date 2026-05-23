export type MetadataSource = 'acrcloud' | 'uploader' | 'manual';
export type RecognitionStatus = 'matched' | 'partial' | 'unmatched' | 'pending_manual';

export interface MetadataEnrichmentJob {
  songId: string;
  uploaderSelectedGenre?: string | null;
}

export interface MetadataProviderInput {
  songId: string;
  audioUrl: string;
  title?: string | null;
}

export interface MetadataProviderResult {
  status: RecognitionStatus;
  source: Exclude<MetadataSource, 'manual'>;
  title?: string;
  artistName?: string;
  genres: string[];
  confidence?: number;
  externalTrackId?: string;
  raw?: unknown;
}

export interface ResolvedMetadataResult {
  status: RecognitionStatus;
  source: MetadataSource;
  genres: string[];
  confidence: number;
  externalTrackId?: string;
  raw?: unknown;
}
