import {
  MetadataProviderResult,
  ResolvedMetadataResult,
} from './metadata.types';

function parseUploaderGenres(value?: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(/[;,/]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 2);
}

export function resolveMetadataResult(
  providerResult: MetadataProviderResult,
  uploaderSelectedGenre?: string | null,
): ResolvedMetadataResult {
  const normalizedProviderGenres = providerResult.genres
    .map((genre) => genre.trim())
    .filter((genre) => genre.length > 0)
    .slice(0, 3);

  if (normalizedProviderGenres.length > 0) {
    return {
      status: providerResult.status === 'matched' ? 'matched' : 'partial',
      source: 'acrcloud',
      genres: normalizedProviderGenres,
      confidence: providerResult.confidence ?? 0.8,
      externalTrackId: providerResult.externalTrackId,
      raw: providerResult.raw,
    };
  }

  const uploaderGenres = parseUploaderGenres(uploaderSelectedGenre);
  if (uploaderGenres.length > 0) {
    return {
      status: providerResult.status === 'matched' ? 'partial' : 'pending_manual',
      source: 'uploader',
      genres: uploaderGenres,
      confidence: 0.45,
      externalTrackId: providerResult.externalTrackId,
      raw: providerResult.raw,
    };
  }

  return {
    status: 'pending_manual',
    source: 'manual',
    genres: [],
    confidence: 0,
    externalTrackId: providerResult.externalTrackId,
    raw: providerResult.raw,
  };
}
