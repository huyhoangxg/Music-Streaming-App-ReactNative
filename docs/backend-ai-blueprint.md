# Recommendation-First Blueprint

## 1. Direction To Lock In

Keep the same 4 blocks:

- mobile app
- Node.js backend
- PostgreSQL + Cloudinary
- Python AI service

But change the responsibility split:

- backend owns upload, persistence, security, metadata enrichment, and fallback logic
- AI service owns user taste profiling and recommendation ranking
- external recognition API such as `ACRCloud` is an adapter, not the core AI engine

This gives you a stronger and more defendable architecture:

- metadata recognition is practical engineering
- recommendation is the AI value you build yourself

## 2. Upload Flow

### 2.1 Sequence

1. Mobile uploads `audioFile`, `artwork`, and optional uploader-selected genre to `POST /api/songs`
2. Node backend stores audio and image on Cloudinary
3. Node backend creates `Song`
4. Node backend schedules metadata enrichment in background
5. Metadata module calls `ACRCloud` or another provider
6. Backend maps provider response into internal metadata
7. Backend persists genres into `Genre` and `SongGenre`
8. If provider has no genre:
   fallback to uploader-selected genre
9. If provider does not match anything:
   mark result as `pending_manual` in the response object now, and later persist it after schema update

### 2.2 Metadata Fallback Rule

Priority should be:

1. provider genres from `ACRCloud`
2. uploader-selected genre
3. manual review / pending status

### 2.3 What Backend Stores Today

With the current Prisma schema, you can already store:

- normalized genres in `Genre`
- song-to-genre links in `SongGenre`

After a schema upgrade, also add:

- `primaryGenre`
- `genreSource`
- `genreConfidence`
- `recognitionStatus`
- `externalTrackId`
- `externalMetadataJson`

## 3. Recommendation Flow

### 3.1 Sequence

1. Backend collects user signals from `PlayHistory`, `Like`, `Repost`, `PlaylistSong`, and `Follow`
2. Backend sends normalized interaction payload to AI service `POST /v1/profile/rebuild`
3. AI service builds a lightweight `taste profile`
4. Backend stores top genres in `UserGenrePreference`
5. Backend fetches candidate songs from PostgreSQL
6. Backend computes cheap numeric features:
   popularity, freshness, collaborative prior
7. Backend calls AI service `POST /v1/recommend`
8. AI service ranks candidates using hybrid scoring
9. Backend stores `RecommendationLog`
10. Mobile receives ranked songs for home feed, autoplay, and similar tracks

### 3.2 Ranking Formula

Base version:

```text
final_score =
0.40 * content_score +
0.30 * collaborative_score +
0.20 * popularity_score +
0.10 * freshness_score
```

This is good enough for an initial demo and easy to explain in defense.

## 4. Target Folder Tree

```text
music-streaming-app/
|-- streaming-app-backend/
|   |-- src/
|   |   |-- controllers/
|   |   |   `-- recommendationController.ts
|   |   |-- modules/
|   |   |   `-- metadata/
|   |   |       |-- metadata.controller.ts
|   |   |       |-- metadata.mapper.ts
|   |   |       |-- metadata.providers.ts
|   |   |       |-- metadata.service.ts
|   |   |       `-- metadata.types.ts
|   |   |-- routes/
|   |   |   |-- metadataRoutes.ts
|   |   |   `-- recommendationRoutes.ts
|   |   |-- services/
|   |   |   |-- aiClient.ts
|   |   |   `-- recommendationService.ts
|   |   `-- types/
|   |       `-- ai.ts
|   `-- .env.example
|-- streaming-app-ai-service/
|   |-- app/
|   |   |-- api/
|   |   |   `-- routes/
|   |   |       |-- health.py
|   |   |       |-- profile.py
|   |   |       `-- recommend.py
|   |   |-- core/
|   |   |   `-- config.py
|   |   |-- repositories/
|   |   |   |-- cache_repository.py
|   |   |   |-- interaction_repository.py
|   |   |   |-- song_repository.py
|   |   |   `-- user_repository.py
|   |   |-- schemas/
|   |   |   |-- common_schema.py
|   |   |   `-- recommend_schema.py
|   |   `-- services/
|   |       |-- autoplay_service.py
|   |       |-- candidate_service.py
|   |       |-- collaborative_ranker.py
|   |       |-- content_ranker.py
|   |       |-- hybrid_ranker.py
|   |       `-- user_profile_service.py
|   `-- README.md
`-- docs/
    `-- backend-ai-blueprint.md
```

## 5. Backend Task Split

### 5.1 Create These Files

- `streaming-app-backend/src/modules/metadata/metadata.controller.ts`
- `streaming-app-backend/src/modules/metadata/metadata.service.ts`
- `streaming-app-backend/src/modules/metadata/metadata.providers.ts`
- `streaming-app-backend/src/modules/metadata/metadata.mapper.ts`
- `streaming-app-backend/src/modules/metadata/metadata.types.ts`
- `streaming-app-backend/src/routes/metadataRoutes.ts`

### 5.2 Modify These Files

- `streaming-app-backend/src/index.ts`
- `streaming-app-backend/src/controllers/songController.ts`
- `streaming-app-backend/src/services/aiClient.ts`
- `streaming-app-backend/src/services/recommendationService.ts`
- `streaming-app-backend/src/types/ai.ts`
- `streaming-app-backend/.env.example`

### 5.3 Remove Or Stop Using These Files

- `streaming-app-backend/src/controllers/aiController.ts`
- `streaming-app-backend/src/routes/aiRoutes.ts`
- `streaming-app-backend/src/services/songAnalysisService.ts`

## 6. AI Service Task Split

### 6.1 Create These Files

- `streaming-app-ai-service/app/api/routes/health.py`
- `streaming-app-ai-service/app/api/routes/profile.py`
- `streaming-app-ai-service/app/api/routes/recommend.py`
- `streaming-app-ai-service/app/schemas/common_schema.py`
- `streaming-app-ai-service/app/schemas/recommend_schema.py`
- `streaming-app-ai-service/app/services/candidate_service.py`
- `streaming-app-ai-service/app/services/content_ranker.py`
- `streaming-app-ai-service/app/services/collaborative_ranker.py`
- `streaming-app-ai-service/app/services/hybrid_ranker.py`
- `streaming-app-ai-service/app/services/autoplay_service.py`
- `streaming-app-ai-service/app/services/user_profile_service.py`
- `streaming-app-ai-service/app/repositories/song_repository.py`
- `streaming-app-ai-service/app/repositories/interaction_repository.py`
- `streaming-app-ai-service/app/repositories/user_repository.py`
- `streaming-app-ai-service/app/repositories/cache_repository.py`

### 6.2 Modify These Files

- `streaming-app-ai-service/app/main.py`
- `streaming-app-ai-service/app/core/config.py`
- `streaming-app-ai-service/README.md`
- `streaming-app-ai-service/.env.example`

### 6.3 Remove Or Stop Using These Files

- `streaming-app-ai-service/app/routers/analyze.py`
- `streaming-app-ai-service/app/schemas/analysis.py`
- `streaming-app-ai-service/app/services/audio_feature_service.py`
- `streaming-app-ai-service/app/services/genre_classifier_service.py`

## 7. Endpoint Order

Build in this order:

1. `GET /health` on FastAPI
2. `POST /v1/profile/rebuild` on FastAPI
3. `POST /v1/recommend` on FastAPI
4. `POST /api/metadata/songs/:songId/enrich` on Node
5. Hook upload flow to background metadata enrichment
6. `POST /api/recommendations/profile/rebuild` on Node
7. `GET /api/recommendations/for-you` on Node
8. `GET /api/recommendations/autoplay/:songId` on Node

## 8. Database Changes To Schedule Next

Add these fields or tables in the next Prisma migration:

- `Song.primaryGenre`
- `Song.genreSource`
- `Song.genreConfidence`
- `Song.recognitionStatus`
- `Song.externalTrackId`
- `Song.externalMetadataJson`
- `RecommendationCache`
- `UserTasteProfile`

## 9. Defense Positioning

This is the clean story:

- external metadata recognition reduces cost and complexity for upload processing
- the custom AI part is the hybrid recommendation engine
- the engine solves:
  cold start, personalized feed, autoplay, similar tracks

That is a stronger engineering narrative than training an audio CNN just because it sounds advanced.
