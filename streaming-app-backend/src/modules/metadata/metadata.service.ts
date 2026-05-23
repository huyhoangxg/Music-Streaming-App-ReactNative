import prisma from '../../prismaClient';
import { resolveMetadataResult } from './metadata.mapper';
import { metadataProvider } from './metadata.providers';
import {
  MetadataEnrichmentJob,
  ResolvedMetadataResult,
} from './metadata.types';

export const metadataService = {
  queueSongMetadataEnrichment(job: MetadataEnrichmentJob) {
    setTimeout(() => {
      void this.enrichSongMetadata(job).catch((error) => {
        console.error(`Metadata enrichment failed for song ${job.songId}:`, error);
      });
    }, 0);
  },

  async enrichSongMetadata(job: MetadataEnrichmentJob) {
    const song = await prisma.song.findUnique({
      where: { id: job.songId },
      select: {
        id: true,
        title: true,
        audioUrl: true,
      },
    });

    if (!song) {
      throw new Error(`Song ${job.songId} not found.`);
    }

    const providerResult = await metadataProvider.recognize({
      songId: song.id,
      title: song.title,
      audioUrl: song.audioUrl,
    });

    const resolved = resolveMetadataResult(providerResult, job.uploaderSelectedGenre);
    await this.persistGenres(song.id, resolved);

    return {
      songId: song.id,
      ...resolved,
    };
  },

  async persistGenres(songId: string, resolved: ResolvedMetadataResult) {
    if (resolved.genres.length === 0) {
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.songGenre.deleteMany({ where: { songId } });

      for (const [index, genreName] of resolved.genres.entries()) {
        const genre = await tx.genre.upsert({
          where: { name: genreName },
          update: {},
          create: { name: genreName },
        });

        await tx.songGenre.create({
          data: {
            songId,
            genreId: genre.id,
            score: Number((resolved.confidence - index * 0.1).toFixed(4)),
            isPrimary: index === 0,
          },
        });
      }
    });
  },

  async getSongMetadata(songId: string) {
    const [song, songGenres] = await Promise.all([
      prisma.song.findUnique({
        where: { id: songId },
        select: {
          id: true,
          title: true,
          audioUrl: true,
          imageUrl: true,
        },
      }),
      prisma.songGenre.findMany({
        where: { songId },
        include: { genre: true },
        orderBy: [{ isPrimary: 'desc' }, { score: 'desc' }],
      }),
    ]);

    if (!song) {
      throw new Error(`Song ${songId} not found.`);
    }

    return {
      songId: song.id,
      title: song.title,
      genres: songGenres.map((item) => ({
        name: item.genre.name,
        score: item.score,
        isPrimary: item.isPrimary,
      })),
      note: 'Current schema only persists normalized genres. Add Song metadata fields in the next migration for source/status/confidence.',
    };
  },
};
