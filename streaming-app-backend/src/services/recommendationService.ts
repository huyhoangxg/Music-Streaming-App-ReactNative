import prisma from '../prismaClient';
import { aiClient } from './aiClient';
import {
  GenreScore,
  ProfileInteractionSignal,
  RecommendationCandidate,
  RecommendationContextType,
  RecommendationItemPayload,
  RecommendationRequestPayload,
  TasteProfileBuildResponsePayload,
} from '../types/ai';

const DEFAULT_LIMIT = Number(process.env.RECOMMENDATION_DEFAULT_LIMIT || 12);
const MAX_INTERACTION_SCORE_PER_SONG = 8;
const MAX_RELATED_USERS = 80;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

function normalizeGenres(songGenres: Array<{ genre: { name: string } }>) {
  return songGenres.map((item) => item.genre.name);
}

function normalizeGenreList(values: Array<string | null | undefined>) {
  const deduped = new Set<string>();

  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      deduped.add(normalized);
    }
  }

  return Array.from(deduped);
}

function parseAiGenresJson(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return { name: item, score: 0 };
      }

      if (item && typeof item === 'object' && 'name' in item) {
        const genreName =
          typeof (item as { name?: unknown }).name === 'string'
            ? (item as { name: string }).name
            : '';
        const scoreValue =
          typeof (item as { score?: unknown }).score === 'number'
            ? (item as { score: number }).score
            : 0;

        return {
          name: genreName,
          score: scoreValue,
        };
      }

      return null;
    })
    .filter((item): item is { name: string; score: number } => Boolean(item?.name));
}

function getSongFeatureGenres(song: {
  finalPrimaryGenre?: string | null;
  uploaderGenre?: string | null;
  aiPrimaryGenre?: string | null;
  aiGenresJson?: unknown;
  songGenres: Array<{ genre: { name: string } }>;
}) {
  const aiGenres = parseAiGenresJson(song.aiGenresJson).map((item) => item.name);
  const relationalGenres = normalizeGenres(song.songGenres);

  return normalizeGenreList([
    ...aiGenres,
    song.finalPrimaryGenre,
    song.aiPrimaryGenre,
    song.uploaderGenre,
    ...relationalGenres,
  ]);
}

function buildPopularityScore(song: {
  playCount: number;
  likeCount: number;
}) {
  const playSignal = Math.min(song.playCount / 500, 1);
  const likeSignal = Math.min(song.likeCount / 100, 1);

  return clamp01(playSignal * 0.6 + likeSignal * 0.4);
}

function buildFreshnessScore(createdAt: Date) {
  const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (ageInDays <= 7) {
    return 1;
  }

  if (ageInDays <= 30) {
    return 0.5;
  }

  return 0.1;
}

function toRecommendationContextSource(contextType: RecommendationContextType) {
  return `hybrid_${contextType}`;
}

function hasGenreOverlap(candidateGenres: string[], preferredGenres: string[]) {
  const preferred = new Set(preferredGenres.map((genre) => genre.toLowerCase()));
  return candidateGenres.some((genre) => preferred.has(genre.toLowerCase()));
}

function buildEmptyProfile(userId: string): TasteProfileBuildResponsePayload {
  return {
    userId,
    topGenres: [],
    topArtists: [],
    activityScore: 0,
    updatedAt: new Date().toISOString(),
  };
}

function formatAiFallbackError(error: unknown) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = error.cause instanceof Error ? ` (${error.cause.message})` : '';
  return `${error.message}${cause}`;
}

type InteractionVector = Map<string, number>;

function addInteractionScore(vector: InteractionVector, songId: string, score: number) {
  if (!songId || score <= 0) {
    return;
  }

  const currentScore = vector.get(songId) ?? 0;
  vector.set(songId, Math.min(currentScore + score, MAX_INTERACTION_SCORE_PER_SONG));
}

function playInteractionScore(item: {
  durationPlayed?: number | null;
  completionRate?: number | null;
}) {
  const completionRate =
    typeof item.completionRate === 'number' && Number.isFinite(item.completionRate)
      ? clamp01(item.completionRate)
      : 0;
  const durationSignal =
    typeof item.durationPlayed === 'number' && Number.isFinite(item.durationPlayed)
      ? Math.min(item.durationPlayed / 180, 1)
      : 0;

  return 1 + completionRate * 2 + durationSignal;
}

function cosineSimilarity(left: InteractionVector, right: InteractionVector) {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (const score of left.values()) {
    leftMagnitude += score * score;
  }

  for (const score of right.values()) {
    rightMagnitude += score * score;
  }

  const [smallerVector, largerVector] =
    left.size <= right.size ? [left, right] : [right, left];

  for (const [songId, score] of smallerVector.entries()) {
    dotProduct += score * (largerVector.get(songId) ?? 0);
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return clamp01(dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude)));
}

function getOrCreateUserVector(vectors: Map<string, InteractionVector>, userId: string) {
  const existingVector = vectors.get(userId);
  if (existingVector) {
    return existingVector;
  }

  const vector = new Map<string, number>();
  vectors.set(userId, vector);
  return vector;
}

async function buildUserInteractionVector(userId: string): Promise<InteractionVector> {
  const [playHistory, likes, playlistAdds, reposts] = await Promise.all([
    prisma.playHistory.findMany({
      where: { userId },
      orderBy: { playedAt: 'desc' },
      take: 250,
      select: { songId: true, durationPlayed: true, completionRate: true },
    }),
    prisma.like.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 150,
      select: { songId: true },
    }),
    prisma.playlistSong.findMany({
      where: { playlist: { userId } },
      orderBy: { addedAt: 'desc' },
      take: 150,
      select: { songId: true },
    }),
    prisma.repost.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 150,
      select: { songId: true },
    }),
  ]);

  const vector = new Map<string, number>();

  for (const item of playHistory) {
    addInteractionScore(vector, item.songId, playInteractionScore(item));
  }

  for (const item of likes) {
    addInteractionScore(vector, item.songId, 3);
  }

  for (const item of playlistAdds) {
    addInteractionScore(vector, item.songId, 4);
  }

  for (const item of reposts) {
    addInteractionScore(vector, item.songId, 2);
  }

  return vector;
}

async function findRelatedUserIds(userId: string, targetSongIds: string[]) {
  if (targetSongIds.length === 0) {
    return [];
  }

  const [playUsers, likeUsers, playlistUsers, repostUsers] = await Promise.all([
    prisma.playHistory.findMany({
      where: {
        songId: { in: targetSongIds },
        userId: { not: userId },
      },
      take: 500,
      select: { userId: true },
    }),
    prisma.like.findMany({
      where: {
        songId: { in: targetSongIds },
        userId: { not: userId },
      },
      take: 500,
      select: { userId: true },
    }),
    prisma.playlistSong.findMany({
      where: {
        songId: { in: targetSongIds },
        playlist: { userId: { not: userId } },
      },
      take: 500,
      select: { playlist: { select: { userId: true } } },
    }),
    prisma.repost.findMany({
      where: {
        songId: { in: targetSongIds },
        userId: { not: userId },
      },
      take: 500,
      select: { userId: true },
    }),
  ]);

  return Array.from(
    new Set([
      ...playUsers.map((item) => item.userId),
      ...likeUsers.map((item) => item.userId),
      ...playlistUsers.map((item) => item.playlist.userId),
      ...repostUsers.map((item) => item.userId),
    ]),
  ).slice(0, MAX_RELATED_USERS);
}

async function buildRelatedUserVectors(userIds: string[]) {
  const vectors = new Map<string, InteractionVector>();

  if (userIds.length === 0) {
    return vectors;
  }

  const [playHistory, likes, playlistAdds, reposts] = await Promise.all([
    prisma.playHistory.findMany({
      where: { userId: { in: userIds } },
      orderBy: { playedAt: 'desc' },
      take: 3000,
      select: { userId: true, songId: true, durationPlayed: true, completionRate: true },
    }),
    prisma.like.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: 'desc' },
      take: 2000,
      select: { userId: true, songId: true },
    }),
    prisma.playlistSong.findMany({
      where: { playlist: { userId: { in: userIds } } },
      orderBy: { addedAt: 'desc' },
      take: 2000,
      select: { songId: true, playlist: { select: { userId: true } } },
    }),
    prisma.repost.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: 'desc' },
      take: 2000,
      select: { userId: true, songId: true },
    }),
  ]);

  for (const item of playHistory) {
    addInteractionScore(
      getOrCreateUserVector(vectors, item.userId),
      item.songId,
      playInteractionScore(item),
    );
  }

  for (const item of likes) {
    addInteractionScore(getOrCreateUserVector(vectors, item.userId), item.songId, 3);
  }

  for (const item of playlistAdds) {
    addInteractionScore(
      getOrCreateUserVector(vectors, item.playlist.userId),
      item.songId,
      4,
    );
  }

  for (const item of reposts) {
    addInteractionScore(getOrCreateUserVector(vectors, item.userId), item.songId, 2);
  }

  return vectors;
}

async function buildCollaborativeScoreMap(userId: string | null, candidateSongIds: string[]) {
  const emptyScores = new Map<string, number>();
  if (!userId || candidateSongIds.length === 0) {
    return emptyScores;
  }

  const targetVector = await buildUserInteractionVector(userId);
  if (targetVector.size === 0) {
    return emptyScores;
  }

  const targetSongIds = Array.from(targetVector.keys());
  const relatedUserIds = await findRelatedUserIds(userId, targetSongIds);
  const relatedVectors = await buildRelatedUserVectors(relatedUserIds);
  const candidateSongIdSet = new Set(candidateSongIds);
  const rawScores = new Map<string, number>();

  for (const relatedVector of relatedVectors.values()) {
    const similarity = cosineSimilarity(targetVector, relatedVector);
    if (similarity <= 0.05) {
      continue;
    }

    for (const [songId, interactionScore] of relatedVector.entries()) {
      if (!candidateSongIdSet.has(songId) || targetVector.has(songId)) {
        continue;
      }

      rawScores.set(songId, (rawScores.get(songId) ?? 0) + similarity * interactionScore);
    }
  }

  const maxRawScore = Math.max(0, ...rawScores.values());
  if (maxRawScore === 0) {
    return emptyScores;
  }

  return new Map(
    candidateSongIds.map((songId) => [
      songId,
      clamp01((rawScores.get(songId) ?? 0) / maxRawScore),
    ]),
  );
}

function applyCollaborativeScores(
  candidates: RecommendationCandidate[],
  collaborativeScoreMap: Map<string, number>,
) {
  return candidates.map((candidate) => ({
    ...candidate,
    collaborativeScore: collaborativeScoreMap.get(candidate.songId) ?? 0,
  }));
}

export const recommendationService = {
  async rebuildUserGenrePreferences(userId: string) {
    const interactions = await this.buildProfileInteractions(userId);
    const profile = await aiClient.buildTasteProfile({
      userId,
      interactions,
    });

    await prisma.$transaction(async (tx) => {
      await tx.userGenrePreference.deleteMany({ where: { userId } });

      for (const affinity of profile.topGenres.slice(0, 10)) {
        const genre = await tx.genre.upsert({
          where: { name: affinity.name },
          update: {},
          create: { name: affinity.name },
        });

        await tx.userGenrePreference.create({
          data: {
            userId,
            genreId: genre.id,
            score: affinity.score,
          },
        });
      }
    });

    return profile;
  },

  async buildProfileInteractions(userId: string): Promise<ProfileInteractionSignal[]> {
    const [playHistory, likes, playlistAdds] = await Promise.all([
      prisma.playHistory.findMany({
        where: { userId },
        orderBy: { playedAt: 'desc' },
        take: 200,
        include: {
          song: {
            include: {
              songGenres: { include: { genre: true } },
            },
          },
        },
      }),
      prisma.like.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          song: {
            include: {
              songGenres: { include: { genre: true } },
            },
          },
        },
      }),
      prisma.playlistSong.findMany({
        where: {
          playlist: {
            userId,
          },
        },
        orderBy: { addedAt: 'desc' },
        take: 100,
        include: {
          song: {
            include: {
              songGenres: { include: { genre: true } },
            },
          },
        },
      }),
    ]);

    return [
      ...playHistory.map((item) => ({
        songId: item.songId,
        artistId: item.song.userId,
        genres: getSongFeatureGenres(item.song),
        completionRate: item.completionRate ?? 0,
        durationPlayed: item.durationPlayed ?? 0,
        playedAt: item.playedAt.toISOString(),
      })),
      ...likes.map((item) => ({
        songId: item.songId,
        artistId: item.song.userId,
        genres: getSongFeatureGenres(item.song),
        liked: true,
        playedAt: item.createdAt.toISOString(),
      })),
      ...playlistAdds.map((item) => ({
        songId: item.songId,
        artistId: item.song.userId,
        genres: getSongFeatureGenres(item.song),
        addedToPlaylist: true,
        playedAt: item.addedAt.toISOString(),
      })),
    ];
  },

  async getStoredTasteProfile(userId: string): Promise<TasteProfileBuildResponsePayload | null> {
    const preferences = await prisma.userGenrePreference.findMany({
      where: { userId },
      include: { genre: true },
      orderBy: { score: 'desc' },
      take: 10,
    });

    if (preferences.length === 0) {
      return null;
    }

    return {
      userId,
      topGenres: preferences.map((item) => ({
        name: item.genre.name,
        score: item.score,
      })),
      topArtists: [],
      activityScore: clamp01(preferences.reduce((total, item) => total + item.score, 0) / 10),
      updatedAt: new Date().toISOString(),
    };
  },

  async ensureTasteProfile(userId: string) {
    const interactions = await this.buildProfileInteractions(userId);

    if (interactions.length === 0) {
      return buildEmptyProfile(userId);
    }

    try {
      return await aiClient.buildTasteProfile({
        userId,
        interactions,
      });
    } catch (error) {
      // console.warn(
      //   `AI profile build unavailable, using stored or empty profile: ${formatAiFallbackError(error)}`,
      // );
      return (await this.getStoredTasteProfile(userId)) ?? buildEmptyProfile(userId);
    }
  },

  async getForYouRecommendations(userId: string, limit = DEFAULT_LIMIT) {
    const safeLimit = Math.max(1, Math.min(limit, 30));
    const [userProfile, recentHistory, candidateSongs] = await Promise.all([
      this.ensureTasteProfile(userId),
      prisma.playHistory.findMany({
        where: { userId },
        orderBy: { playedAt: 'desc' },
        take: 20,
        select: { songId: true },
      }),
      prisma.song.findMany({
        where: {
          privacy: 'PUBLIC',
          userId: { not: userId },
          audioUrl: { not: '' },
        },
        include: {
          user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
          songGenres: { include: { genre: true } },
        },
        orderBy: [{ playCount: 'desc' }, { likeCount: 'desc' }, { createdAt: 'desc' }],
        take: 120,
      }),
    ]);

    const recentSongIds = new Set(recentHistory.map((item) => item.songId));
    const preferredGenres = userProfile.topGenres.slice(0, 3).map((item) => item.name);

    const filteredSongs = candidateSongs
      .filter((song) => !recentSongIds.has(song.id))
      .sort((left, right) => {
        const leftMatch = hasGenreOverlap(getSongFeatureGenres(left), preferredGenres) ? 1 : 0;
        const rightMatch = hasGenreOverlap(getSongFeatureGenres(right), preferredGenres) ? 1 : 0;
        return rightMatch - leftMatch;
      })
      .slice(0, 60);

    const collaborativeScoreMap = await buildCollaborativeScoreMap(
      userId,
      filteredSongs.map((song) => song.id),
    );
    const candidates = applyCollaborativeScores(
      this.buildCandidates(filteredSongs),
      collaborativeScoreMap,
    );

    const rankedItems = await this.tryAiRanking({
      userId,
      contextType: 'home_feed',
      limit: safeLimit,
      recentSongIds: Array.from(recentSongIds),
      userProfile,
      candidates,
    });

    return this.attachSongsAndLog(userId, filteredSongs, rankedItems, safeLimit, 'home_feed');
  },

  async getAutoplayRecommendations(userId: string, seedSongId: string, limit = 10) {
    const safeLimit = Math.max(1, Math.min(limit, 20));
    const [userProfile, seedSong, recentHistory, candidateSongs] = await Promise.all([
      this.ensureTasteProfile(userId),
      prisma.song.findUnique({
        where: { id: seedSongId },
        include: {
          songGenres: { include: { genre: true } },
        },
      }),
      prisma.playHistory.findMany({
        where: { userId },
        orderBy: { playedAt: 'desc' },
        take: 10,
        select: { songId: true },
      }),
      prisma.song.findMany({
        where: {
          privacy: 'PUBLIC',
          id: { not: seedSongId },
          audioUrl: { not: '' },
        },
        include: {
          user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
          songGenres: { include: { genre: true } },
        },
        orderBy: [{ playCount: 'desc' }, { likeCount: 'desc' }, { createdAt: 'desc' }],
        take: 120,
      }),
    ]);

    if (!seedSong) {
      return [];
    }

    const seedGenres = getSongFeatureGenres(seedSong);
    const recentSongIds = new Set(recentHistory.map((item) => item.songId));
    recentSongIds.add(seedSongId);

    const filteredSongs = candidateSongs
      .filter((song) => !recentSongIds.has(song.id))
      .sort((left, right) => {
        const leftOverlap = hasGenreOverlap(getSongFeatureGenres(left), seedGenres) ? 1 : 0;
        const rightOverlap = hasGenreOverlap(getSongFeatureGenres(right), seedGenres) ? 1 : 0;
        if (leftOverlap !== rightOverlap) {
          return rightOverlap - leftOverlap;
        }

        if (left.userId !== seedSong.userId && right.userId === seedSong.userId) {
          return -1;
        }

        if (left.userId === seedSong.userId && right.userId !== seedSong.userId) {
          return 1;
        }

        return 0;
      })
      .slice(0, 60);

    const collaborativeScoreMap = await buildCollaborativeScoreMap(
      userId,
      filteredSongs.map((song) => song.id),
    );
    const candidates = applyCollaborativeScores(
      this.buildCandidates(filteredSongs),
      collaborativeScoreMap,
    );

    const rankedItems = await this.tryAiRanking({
      userId,
      contextType: 'autoplay',
      seedSongId,
      seedGenres,
      seedArtistId: seedSong.userId,
      preferDifferentArtist: true,
      limit: safeLimit,
      recentSongIds: Array.from(recentSongIds),
      userProfile,
      candidates,
    });

    return this.attachSongsAndLog(userId, filteredSongs, rankedItems, safeLimit, 'autoplay');
  },

  async getSimilarRecommendations(userId: string | null, seedSongId: string, limit = 10) {
    const safeLimit = Math.max(1, Math.min(limit, 20));

    const [seedSong, candidateSongs, userProfile] = await Promise.all([
      prisma.song.findUnique({
        where: { id: seedSongId },
        include: {
          songGenres: { include: { genre: true } },
        },
      }),
      prisma.song.findMany({
        where: {
          privacy: 'PUBLIC',
          id: { not: seedSongId },
          audioUrl: { not: '' },
        },
        include: {
          user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
          songGenres: { include: { genre: true } },
        },
        orderBy: [{ playCount: 'desc' }, { likeCount: 'desc' }, { createdAt: 'desc' }],
        take: 120,
      }),
      userId ? this.ensureTasteProfile(userId) : Promise.resolve(buildEmptyProfile('guest')),
    ]);

    if (!seedSong) {
      return [];
    }

    const seedGenres = getSongFeatureGenres(seedSong);
    const filteredSongs = candidateSongs
      .sort((left, right) => {
        const leftOverlap = hasGenreOverlap(getSongFeatureGenres(left), seedGenres) ? 1 : 0;
        const rightOverlap = hasGenreOverlap(getSongFeatureGenres(right), seedGenres) ? 1 : 0;
        if (leftOverlap !== rightOverlap) {
          return rightOverlap - leftOverlap;
        }
        return 0;
      })
      .slice(0, 60);

    const collaborativeScoreMap = await buildCollaborativeScoreMap(
      userId,
      filteredSongs.map((song) => song.id),
    );
    const candidates = applyCollaborativeScores(
      this.buildCandidates(filteredSongs),
      collaborativeScoreMap,
    );

    const rankedItems = await this.tryAiRanking({
      userId: userId ?? 'guest',
      contextType: 'similar_tracks',
      seedSongId,
      seedGenres,
      seedArtistId: seedSong.userId,
      preferDifferentArtist: true,
      limit: safeLimit,
      recentSongIds: [seedSongId],
      userProfile,
      candidates,
    });

    return this.attachSongsAndLog(userId, filteredSongs, rankedItems, safeLimit, 'similar_tracks');
  },

  buildCandidates(songs: any[]): RecommendationCandidate[] {
    return songs.map((song) => ({
      songId: song.id,
      title: song.title,
      artistId: song.userId,
      finalPrimaryGenre: song.finalPrimaryGenre,
      uploaderGenre: song.uploaderGenre,
      aiPrimaryGenre: song.aiPrimaryGenre,
      aiGenres: parseAiGenresJson(song.aiGenresJson),
      genres: getSongFeatureGenres(song),
      tags: normalizeGenreList([
        song.finalPrimaryGenre,
        song.aiPrimaryGenre,
        song.uploaderGenre,
        ...normalizeGenres(song.songGenres),
      ]),
      popularityScore: buildPopularityScore(song),
      freshnessScore: buildFreshnessScore(song.createdAt),
      collaborativeScore: 0,
    }));
  },

  async tryAiRanking(payload: RecommendationRequestPayload) {
    try {
      const response = await aiClient.rankRecommendations(payload);
      if (response.items.length > 0) {
        return response.items;
      }
    } catch (error) {
      // console.warn(`AI ranking unavailable, using local fallback: ${formatAiFallbackError(error)}`);
    }

    return this.localFallback(payload);
  },

  localFallback(payload: RecommendationRequestPayload) {
    const preferredGenres = new Set(payload.userProfile.topGenres.map((item) => item.name.toLowerCase()));
    const seedGenres = new Set((payload.seedGenres ?? []).map((genre) => genre.toLowerCase()));

    return payload.candidates
      .map<RecommendationItemPayload>((candidate) => {
        const candidateGenres = candidate.genres.map((genre) => genre.toLowerCase());
        const homeGenreOverlap = candidateGenres.filter((genre) => preferredGenres.has(genre)).length;
        const seedGenreOverlap = candidateGenres.filter((genre) => seedGenres.has(genre)).length;

        const contentScore =
          payload.contextType === 'home_feed'
            ? clamp01(homeGenreOverlap > 0 ? 0.7 + Math.min(homeGenreOverlap - 1, 2) * 0.15 : 0)
            : clamp01(
                (seedGenreOverlap > 0 ? 0.75 : 0) +
                  (payload.preferDifferentArtist && payload.seedArtistId === candidate.artistId ? -0.1 : 0),
              );
        const collaborativeScore = clamp01(candidate.collaborativeScore);

        const finalScore = clamp01(
          contentScore * 0.4 +
            collaborativeScore * 0.3 +
            candidate.popularityScore * 0.2 +
            candidate.freshnessScore * 0.1,
        );

        const reasons =
          payload.contextType === 'autoplay'
            ? ['Same genre continuation', 'Popularity fallback']
            : payload.contextType === 'similar_tracks'
              ? ['Similar track by genre and metadata']
              : collaborativeScore >= 0.35
                ? ['People with similar listening behavior interacted with this track']
                : contentScore > 0
                ? ['Genre overlap with recent listening taste']
                : ['Popularity and freshness fallback'];

        return {
          songId: candidate.songId,
          contentScore,
          collaborativeScore,
          popularityScore: candidate.popularityScore,
          freshnessScore: candidate.freshnessScore,
          finalScore,
          reasons,
        };
      })
      .sort((left, right) => right.finalScore - left.finalScore)
      .slice(0, payload.limit ?? DEFAULT_LIMIT);
  },

  async attachSongsAndLog(
    userId: string | null,
    songs: any[],
    rankedItems: RecommendationItemPayload[],
    limit: number,
    contextType: RecommendationContextType,
  ) {
    const songMap = new Map(songs.map((song) => [song.id, song]));
    const selectedItems = rankedItems
      .map((item) => ({
        ...item,
        song: songMap.get(item.songId),
      }))
      .filter((item) => Boolean(item.song?.audioUrl))
      .slice(0, limit);

    if (userId && selectedItems.length > 0) {
      await prisma.recommendationLog.createMany({
        data: selectedItems.map((item) => ({
          userId,
          songId: item.songId,
          source: toRecommendationContextSource(contextType),
          score: item.finalScore,
        })),
      });
    }

    return selectedItems.map((item) => ({
      ...item.song,
      sourceContext:
        contextType === 'home_feed'
          ? 'home'
          : contextType === 'autoplay'
            ? 'autoplay'
            : 'similar',
      recommendation: {
        contentScore: item.contentScore,
        collaborativeScore: item.collaborativeScore,
        popularityScore: item.popularityScore,
        freshnessScore: item.freshnessScore,
        finalScore: item.finalScore,
        reasons: item.reasons,
      },
    }));
  },
};
