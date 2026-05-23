ALTER TABLE "Song" RENAME COLUMN "fileUrl" TO "audioUrl";

ALTER TABLE "Song"
ADD COLUMN     "aiErrorMessage" TEXT,
ADD COLUMN     "aiGenresJson" JSONB,
ADD COLUMN     "aiModelVersion" TEXT,
ADD COLUMN     "aiPrimaryGenre" TEXT,
ADD COLUMN     "aiStatus" TEXT,
ADD COLUMN     "finalPrimaryGenre" TEXT,
ADD COLUMN     "genreConfidence" DOUBLE PRECISION,
ADD COLUMN     "genreSource" TEXT,
ADD COLUMN     "uploaderGenre" TEXT;

-- CreateIndex
CREATE INDEX "Song_finalPrimaryGenre_idx" ON "Song"("finalPrimaryGenre");
