import { FollowStatus, NotificationType, Prisma, Song } from '@prisma/client';
import type { UploadApiOptions, UploadApiResponse } from 'cloudinary';
import prisma from '../../config/prisma';
import { AppError } from '../../middlewares/errorMiddleware';
import { analyzeSong } from '../../services/aiClient';
import { GenreScore } from '../../types/ai';
import { destroyCloudinaryAsset, uploadToCloudinary } from '../../utils/uploadToCloudinary';

interface UploadSongInput {
  title: string;
  userId: string;
  description?: string | null;
  uploaderGenre?: string | null;
  audioFile?: Express.Multer.File;
  imageFile?: Express.Multer.File;
}

type ResolvedGenreDecision = {
  finalPrimaryGenre: string;
  genreSource: 'ai' | 'uploader' | 'system';
};

const MIN_AI_GENRE_CONFIDENCE = Number(process.env.MIN_AI_GENRE_CONFIDENCE || 0.5);
const DEFAULT_FALLBACK_GENRE = 'Other';
const DEFAULT_SONG_IMAGE_URL =
  'https://lh7-rt.googleusercontent.com/docsz/AD_4nXczbbtwTVkSSprOErZVS60gZa_MbQJi2LnYWpKpQtvz8yDqdIcCJzzOBK7_D42sMCiDybJDivoGOEE6JB_sgq3xTwIa2pQF0iyktOUw4CbK6tYx1aucVF4S1649SryiaEYiSd6Hbg?key=oVwJm0GWQeRqGP0qoG4MOJFL';
const ALLOWED_UPLOADER_GENRES = new Set([
  'Pop',
  'Rap/Hip-Hop',
  'R&B',
  'Rock',
  'Indie',
  'EDM',
  'Lo-Fi',
  'Jazz',
  'Acoustic',
  'Bolero',
  'Other',
]);
const LEGACY_GENRE_ALIASES = new Map([
  ['hip hop', 'Rap/Hip-Hop'],
  ['hip-hop', 'Rap/Hip-Hop'],
  ['hiphop', 'Rap/Hip-Hop'],
  ['rap', 'Rap/Hip-Hop'],
  ['rap hip hop', 'Rap/Hip-Hop'],
  ['rap/hip-hop', 'Rap/Hip-Hop'],
  ['rap/hiphop', 'Rap/Hip-Hop'],
  ['classical', DEFAULT_FALLBACK_GENRE],
]);

function sanitizeSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function normalizeGenre(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  return LEGACY_GENRE_ALIASES.get(normalized.toLowerCase()) ?? normalized;
}

function normalizeDescription(value?: string | null) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeConfidence(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeAiGenres(value?: GenreScore[] | null): GenreScore[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => ({
      name: typeof item?.name === 'string' ? item.name.trim() : '',
      score: Number(item?.score),
    }))
    .filter((item) => item.name && Number.isFinite(item.score) && item.score > 0)
    .slice(0, 5);
}

function buildPublicId(userId: string, title: string, suffix: 'audio' | 'image') {
  const safeUserId = sanitizeSegment(userId);
  const safeTitle = sanitizeSegment(title || 'untitled-track');
  return `soundwave/${suffix}/${safeUserId}/${Date.now()}-${safeTitle}`;
}

function chooseFinalGenre(params: {
  uploaderGenre?: string | null;
  aiPrimaryGenre?: string | null;
  confidence?: number | null;
}): ResolvedGenreDecision {
  const uploaderGenre = normalizeGenre(params.uploaderGenre);
  const aiPrimaryGenre = normalizeGenre(params.aiPrimaryGenre);
  const confidence = normalizeConfidence(params.confidence);

  if (uploaderGenre === 'Bolero') {
    return {
      finalPrimaryGenre: uploaderGenre,
      genreSource: 'uploader',
    };
  }

  if (aiPrimaryGenre && confidence !== null && confidence >= MIN_AI_GENRE_CONFIDENCE) {
    return {
      finalPrimaryGenre: aiPrimaryGenre,
      genreSource: 'ai',
    };
  }

  if (uploaderGenre) {
    return {
      finalPrimaryGenre: uploaderGenre,
      genreSource: 'uploader',
    };
  }

  return {
    finalPrimaryGenre: DEFAULT_FALLBACK_GENRE,
    genreSource: 'system',
  };
}

function buildFallbackGenres(uploaderGenre?: string | null): GenreScore[] {
  const normalized = normalizeGenre(uploaderGenre);

  if (!normalized) {
    return [{ name: DEFAULT_FALLBACK_GENRE, score: 0.1 }];
  }

  return [{ name: normalized, score: 0.35 }];
}

function buildPersistedAiGenres(
  aiGenres: GenreScore[],
  aiPrimaryGenre?: string | null,
  confidence?: number | null,
): GenreScore[] {
  if (aiGenres.length > 0) {
    return aiGenres;
  }

  const normalizedPrimaryGenre = normalizeGenre(aiPrimaryGenre);
  if (!normalizedPrimaryGenre) {
    return [];
  }

  return [
    {
      name: normalizedPrimaryGenre,
      score: normalizeConfidence(confidence) ?? MIN_AI_GENRE_CONFIDENCE,
    },
  ];
}

function formatAiError(error: unknown) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = error.cause instanceof Error ? ` (${error.cause.message})` : '';
  return `${error.message}${cause}`;
}

function formatGenreScores(genres: GenreScore[]) {
  if (genres.length === 0) {
    return 'none';
  }

  return genres.map((genre) => `${genre.name}=${genre.score.toFixed(3)}`).join(', ');
}

async function cleanupCloudinaryUploads(uploads: UploadApiResponse[]) {
  for (const upload of uploads) {
    if (!upload.public_id) {
      continue;
    }

    try {
      await destroyCloudinaryAsset(
        upload.public_id,
        upload.resource_type === 'image' ? 'image' : 'video',
      );
    } catch (cleanupError) {
      console.error(`Failed to clean up Cloudinary asset ${upload.public_id}:`, cleanupError);
    }
  }
}

async function persistSongGenres(
  tx: Prisma.TransactionClient,
  songId: string,
  genres: GenreScore[],
) {
  await tx.songGenre.deleteMany({ where: { songId } });

  for (const [index, genreItem] of genres.entries()) {
    const genre = await tx.genre.upsert({
      where: { name: genreItem.name },
      update: {},
      create: { name: genreItem.name },
    });

    await tx.songGenre.create({
      data: {
        songId,
        genreId: genre.id,
        score: Number(genreItem.score.toFixed(4)),
        isPrimary: index === 0,
      },
    });
  }
}

async function createFollowerUploadNotifications(
  tx: Prisma.TransactionClient,
  songId: string,
  actorId: string,
) {
  const followers = await tx.follow.findMany({
    where: {
      followedId: actorId,
      status: FollowStatus.ACCEPTED,
    },
    select: {
      followerId: true,
    },
  });

  if (followers.length === 0) {
    return;
  }

  await tx.notification.createMany({
    data: followers.map((follower) => ({
      userId: follower.followerId,
      actorId,
      type: NotificationType.NEW_TRACK,
      referenceId: songId,
    })),
  });
}

function serializeSong(song: Song) {
  return {
    id: song.id,
    songId: song.id,
    title: song.title,
    audioUrl: song.audioUrl,
    imageUrl: song.imageUrl,
    description: song.description,
    userId: song.userId,
    uploaderGenre: song.uploaderGenre,
    aiPrimaryGenre: song.aiPrimaryGenre,
    aiGenresJson: song.aiGenresJson,
    finalPrimaryGenre: song.finalPrimaryGenre,
    genreSource: song.genreSource,
    genreConfidence: song.genreConfidence,
    aiStatus: song.aiStatus,
    aiErrorMessage: song.aiErrorMessage,
    aiModelVersion: song.aiModelVersion,
    createdAt: song.createdAt,
    updatedAt: song.updatedAt,
  };
}

async function analyzeAndPersistSongGenre(createdSong: Song) {
  try {
    const aiResult = await analyzeSong({
      songId: createdSong.id,
      audioUrl: createdSong.audioUrl,
      title: createdSong.title,
    });

    const aiGenres = normalizeAiGenres(aiResult.genres);
    const rawAiPrimaryGenre = normalizeGenre(aiResult.primaryGenre) ?? aiGenres[0]?.name ?? null;
    const confidence = normalizeConfidence(aiResult.confidence);
    const aiPrimaryGenre = aiResult.status === 'success' ? rawAiPrimaryGenre : null;
    const finalGenreDecision = chooseFinalGenre({
      uploaderGenre: createdSong.uploaderGenre,
      aiPrimaryGenre,
      confidence,
    });
    const persistedGenres =
      finalGenreDecision.genreSource === 'ai'
        ? buildPersistedAiGenres(aiGenres, aiPrimaryGenre, confidence)
        : buildFallbackGenres(createdSong.uploaderGenre);

    await prisma.$transaction(async (tx) => {
      const song = await tx.song.update({
        where: { id: createdSong.id },
        data: {
          aiPrimaryGenre,
          aiGenresJson:
            aiGenres.length > 0
              ? (aiGenres as unknown as Prisma.InputJsonValue)
              : Prisma.DbNull,
          finalPrimaryGenre: finalGenreDecision.finalPrimaryGenre,
          genreSource: finalGenreDecision.genreSource,
          genreConfidence: confidence,
          aiStatus: aiResult.status,
          aiErrorMessage: aiResult.errorMessage ?? null,
          aiModelVersion: aiResult.modelVersion ?? null,
        },
      });

      await persistSongGenres(tx, song.id, persistedGenres);
    });

    console.info(
      `Song genre saved: title="${createdSong.title}", songId=${createdSong.id}, ` +
        `ai=${aiPrimaryGenre ?? 'none'}, final=${finalGenreDecision.finalPrimaryGenre}, ` +
        `source=${finalGenreDecision.genreSource}, confidence=${confidence ?? 'n/a'}, ` +
        `top=${formatGenreScores(aiGenres)}`,
    );
  } catch (error) {
    console.warn(`AI analysis failed for song ${createdSong.id}: ${formatAiError(error)}`);

    try {
      const fallbackDecision = chooseFinalGenre({
        uploaderGenre: createdSong.uploaderGenre,
        aiPrimaryGenre: null,
        confidence: null,
      });
      await prisma.$transaction(async (tx) => {
        const song = await tx.song.update({
          where: { id: createdSong.id },
          data: {
            aiPrimaryGenre: null,
            aiGenresJson: Prisma.DbNull,
            finalPrimaryGenre: fallbackDecision.finalPrimaryGenre,
            genreSource: fallbackDecision.genreSource,
            genreConfidence: null,
            aiStatus: 'failed',
            aiErrorMessage: formatAiError(error) || 'AI analyze failed.',
            aiModelVersion: null,
          },
        });

        await persistSongGenres(tx, song.id, buildFallbackGenres(createdSong.uploaderGenre));
      });
    } catch (fallbackError) {
      console.error(`Fallback song update failed for song ${createdSong.id}:`, fallbackError);
    }
  }
}

let genreAnalysisQueue: Promise<void> = Promise.resolve();

function enqueueSongGenreAnalysis(song: Song) {
  genreAnalysisQueue = genreAnalysisQueue
    .then(() => analyzeAndPersistSongGenre(song))
    .catch((error) => {
      console.error(`Queued AI analysis failed for song ${song.id}:`, error);
    });
}

export const songUploadService = {
  async uploadSong({
    title,
    userId,
    description,
    uploaderGenre,
    audioFile,
    imageFile,
  }: UploadSongInput) {
    const normalizedTitle = title.trim();
    const normalizedDescription = normalizeDescription(description);
    const normalizedUploaderGenre = normalizeGenre(uploaderGenre);

    if (!normalizedTitle) {
      throw new AppError(400, 'Title is required.');
    }

    if (!audioFile) {
      throw new AppError(400, 'Audio file is required.');
    }

    if (!normalizedUploaderGenre) {
      throw new AppError(400, 'Genre is required.');
    }

    if (!ALLOWED_UPLOADER_GENRES.has(normalizedUploaderGenre)) {
      throw new AppError(400, 'Unsupported genre selected.');
    }

    const uploadedAssets: UploadApiResponse[] = [];

    const audioOptions: UploadApiOptions = {
      folder: 'soundwave/audio',
      resource_type: 'video',
      public_id: buildPublicId(userId, normalizedTitle, 'audio'),
      overwrite: false,
    };

    let audioUpload: UploadApiResponse;
    try {
      audioUpload = await uploadToCloudinary(audioFile, audioOptions);
      uploadedAssets.push(audioUpload);
    } catch (error) {
      throw new AppError(502, 'Failed to upload audio.', error);
    }

    let imageUpload: UploadApiResponse | null = null;
    if (imageFile) {
      const imageOptions: UploadApiOptions = {
        folder: 'soundwave/images',
        resource_type: 'image',
        public_id: buildPublicId(userId, normalizedTitle, 'image'),
        overwrite: false,
      };

      try {
        imageUpload = await uploadToCloudinary(imageFile, imageOptions);
        uploadedAssets.push(imageUpload);
      } catch (error) {
        await cleanupCloudinaryUploads(uploadedAssets);
        throw new AppError(502, 'Failed to upload image.', error);
      }
    }

    const initialGenreDecision = chooseFinalGenre({
      uploaderGenre: normalizedUploaderGenre,
      aiPrimaryGenre: null,
      confidence: null,
    });

    let createdSong: Song;
    try {
      createdSong = await prisma.$transaction(async (tx) => {
        const song = await tx.song.create({
          data: {
            title: normalizedTitle,
            audioUrl: audioUpload.secure_url,
            imageUrl: imageUpload?.secure_url ?? DEFAULT_SONG_IMAGE_URL,
            description: normalizedDescription,
            userId,
            uploaderGenre: normalizedUploaderGenre,
            aiPrimaryGenre: null,
            aiGenresJson: Prisma.DbNull,
            finalPrimaryGenre: initialGenreDecision.finalPrimaryGenre,
            genreSource: initialGenreDecision.genreSource,
            genreConfidence: null,
            aiStatus: 'pending',
            aiErrorMessage: null,
            aiModelVersion: null,
            privacy: 'PUBLIC',
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: { trackCount: { increment: 1 } },
        });

        await createFollowerUploadNotifications(tx, song.id, userId);

        await persistSongGenres(tx, song.id, buildFallbackGenres(normalizedUploaderGenre));

        return song;
      });
    } catch (error) {
      await cleanupCloudinaryUploads(uploadedAssets);
      throw new AppError(500, 'Failed to create song record.', error);
    }

    enqueueSongGenreAnalysis(createdSong);

    return serializeSong(createdSong);
  },
};
