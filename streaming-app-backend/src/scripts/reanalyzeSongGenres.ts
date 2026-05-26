import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { aiClient, analyzeSong } from '../services/aiClient';
import { GenreScore } from '../types/ai';

type ResolvedGenreDecision = {
  finalPrimaryGenre: string;
  genreSource: 'ai' | 'uploader' | 'system';
};

type CliOptions = {
  all: boolean;
  dryRun: boolean;
  limit?: number;
  songId?: string;
};

const MIN_AI_GENRE_CONFIDENCE = Number(process.env.MIN_AI_GENRE_CONFIDENCE || 0.5);
const DEFAULT_FALLBACK_GENRE = 'Other';
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

function parseArgs(): CliOptions {
  const options: CliOptions = {
    all: false,
    dryRun: false,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg === '--all') {
      options.all = true;
      continue;
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg.startsWith('--limit=')) {
      const limit = Number(arg.slice('--limit='.length));
      if (Number.isFinite(limit) && limit > 0) {
        options.limit = Math.floor(limit);
      }
      continue;
    }

    if (arg.startsWith('--song-id=')) {
      const songId = arg.slice('--song-id='.length).trim();
      if (songId) {
        options.songId = songId;
      }
    }
  }

  return options;
}

function normalizeGenre(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  return LEGACY_GENRE_ALIASES.get(normalized.toLowerCase()) ?? normalized;
}

function formatError(error: unknown) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = error.cause instanceof Error ? ` (${error.cause.message})` : '';
  return `${error.message}${cause}`;
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

function formatGenreScores(genres: GenreScore[]) {
  if (genres.length === 0) {
    return 'none';
  }

  return genres.map((genre) => `${genre.name}=${genre.score.toFixed(3)}`).join(', ');
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

function shouldProcessSong(
  song: {
    aiStatus: string | null;
    aiPrimaryGenre: string | null;
    finalPrimaryGenre: string | null;
  },
  options: CliOptions,
) {
  if (options.all || options.songId) {
    return true;
  }

  return (
    song.aiStatus === null ||
    song.aiStatus === 'pending' ||
    song.aiStatus === 'failed' ||
    song.aiPrimaryGenre === null ||
    song.finalPrimaryGenre === null
  );
}

async function main() {
  const options = parseArgs();

  try {
    const health = await aiClient.healthCheck();
    if (health.status !== 'ok') {
      throw new Error(
        `AI service is not ready. status=${health.status}, readinessIssues=${JSON.stringify(
          health.readinessIssues ?? [],
        )}`,
      );
    }
  } catch (error) {
    throw new Error(
      `Cannot connect to AI service before reanalysis: ${formatError(error)}. ` +
        'Start streaming-app-ai-service on port 8000 or set AI_SERVICE_URL in streaming-app-backend/.env.',
    );
  }

  const songs = await prisma.song.findMany({
    where: {
      ...(options.songId ? { id: options.songId } : {}),
      audioUrl: { not: '' },
    },
    select: {
      id: true,
      title: true,
      audioUrl: true,
      uploaderGenre: true,
      aiStatus: true,
      aiPrimaryGenre: true,
      finalPrimaryGenre: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const matchingSongs = songs.filter((song) => shouldProcessSong(song, options));
  const targetSongs = options.limit ? matchingSongs.slice(0, options.limit) : matchingSongs;

  console.log(
    `Found ${songs.length} song(s), processing ${targetSongs.length}. ` +
      `Mode: ${options.dryRun ? 'dry-run' : 'write'}.`,
  );

  let succeeded = 0;
  let failed = 0;
  let aiSucceeded = 0;
  let aiFailed = 0;

  for (const [index, song] of targetSongs.entries()) {
    console.log(`[${index + 1}/${targetSongs.length}] Analyzing "${song.title}" (${song.id})`);

    try {
      const aiResult = await analyzeSong({
        songId: song.id,
        audioUrl: song.audioUrl,
        title: song.title,
      });

      const aiGenres = normalizeAiGenres(aiResult.genres);
      const rawAiPrimaryGenre = normalizeGenre(aiResult.primaryGenre) ?? aiGenres[0]?.name ?? null;
      const confidence = normalizeConfidence(aiResult.confidence);
      const aiPrimaryGenre = aiResult.status === 'success' ? rawAiPrimaryGenre : null;
      const finalGenreDecision = chooseFinalGenre({
        uploaderGenre: song.uploaderGenre,
        aiPrimaryGenre,
        confidence,
      });
      const persistedGenres =
        finalGenreDecision.genreSource === 'ai'
          ? buildPersistedAiGenres(aiGenres, aiPrimaryGenre, confidence)
          : buildFallbackGenres(song.uploaderGenre);

      if (!options.dryRun) {
        await prisma.$transaction(async (tx) => {
          await tx.song.update({
            where: { id: song.id },
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
      }

      succeeded += 1;
      if (aiResult.status === 'success') {
        aiSucceeded += 1;
      } else {
        aiFailed += 1;
      }
      console.log(
        `  -> ${aiResult.status}: ai=${aiPrimaryGenre ?? 'none'}, ` +
          `final=${finalGenreDecision.finalPrimaryGenre}, confidence=${confidence ?? 'n/a'}, ` +
          `top=${formatGenreScores(aiGenres)}` +
          (aiResult.errorMessage ? `, error="${aiResult.errorMessage}"` : ''),
      );
    } catch (error) {
      failed += 1;
      const message = formatError(error);
      console.error(`  -> failed: ${message}`);
    }
  }

  console.log(
    `Done. processed=${succeeded}, requestFailed=${failed}, aiSucceeded=${aiSucceeded}, ` +
      `aiFailed=${aiFailed}, skipped=${songs.length - targetSongs.length}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
