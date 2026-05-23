# Streaming App AI Service

FastAPI service for two jobs in the project:

- auto-tag uploaded songs with Essentia through `POST /analyze/song`
- rank recommendation candidates for `home_feed`, `autoplay`, and `similar_tracks`

## What is done

- `GET /health` reports runtime readiness for Essentia and the model files
- `POST /analyze/song` accepts `songId` and `audioUrl`, downloads the audio, runs inference, and returns top genres
- `POST /v1/profile/rebuild` builds a lightweight taste profile from listening interactions
- `POST /v1/recommend` ranks candidates with recommendation v1

## Required runtime

Run Essentia in Linux, WSL, or Docker. Windows native Python is not the target runtime.

Required model files under `./models`:

- `discogs-effnet-bs64-1.pb`
- `discogs-effnet-bs64-1.json`
- `mtg_jamendo_genre-discogs-effnet-1.pb`
- `mtg_jamendo_genre-discogs-effnet-1.json`

## Environment

Create `.env` in `streaming-app-ai-service`:

```env
PORT=8000
ESSENTIA_ENABLED=true
GENRE_ANALYSIS_MOCK_ENABLED=false
MODELS_DIR=./models
EMBEDDING_MODEL_PATH=./models/discogs-effnet-bs64-1.pb
EMBEDDING_METADATA_PATH=./models/discogs-effnet-bs64-1.json
GENRE_MODEL_PATH=./models/mtg_jamendo_genre-discogs-effnet-1.pb
GENRE_METADATA_PATH=./models/mtg_jamendo_genre-discogs-effnet-1.json
GENRE_CLASSIFIER_BACKEND=essentia
```

For a custom classifier trained from the Colab notebook in this repo, switch only the classifier
head while keeping the same embedding model:

```env
GENRE_CLASSIFIER_BACKEND=keras
GENRE_MODEL_PATH=./models/soundwave_genre_classifier.keras
GENRE_METADATA_PATH=./models/soundwave_genre_classifier.json
```

If `GENRE_CLASSIFIER_BACKEND=keras` fails with a TensorFlow import error, install TensorFlow in the
same WSL virtual environment:

```bash
pip install tensorflow
```

## Run the AI service

Verified WSL flow on this project:

Create the shared virtual environment once:

```bash
python3 -m venv ~/.venv_streaming_ai
```

Activate it and install dependencies:

```bash
cd /mnt/d/DownloadApps/vscode/workSpace/music-streaming-app/streaming-app-ai-service
source ~/.venv_streaming_ai/bin/activate
pip install -r requirements.txt
```

Optional:

```bash
pip install --upgrade pip
```

Start the service:

```bash
cd /mnt/d/DownloadApps/vscode/workSpace/music-streaming-app/streaming-app-ai-service
source ~/.venv_streaming_ai/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

If you want a project-local environment instead, this also works:

```bash
cd /mnt/d/DownloadApps/vscode/workSpace/music-streaming-app/streaming-app-ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Docker:

```bash
cd /mnt/d/DownloadApps/vscode/workSpace/music-streaming-app/streaming-app-ai-service
docker build -t streaming-app-ai-service .
docker run --rm -p 8000:8000 --env-file .env streaming-app-ai-service
```

## Test health

Expected readiness checks:

- `essentiaImportOk = true`
- all four model files exist
- `genre_labels_count = 87`

PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

curl:

```bash
curl http://127.0.0.1:8000/health
```

## Test analyze

Example request:

```powershell
$body = @{
  songId = "demo-song-001"
  audioUrl = "https://example.com/file.mp3"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/analyze/song `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

Successful response shape:

```json
{
  "songId": "demo-song-001",
  "primaryGenre": "hiphop",
  "genres": [
    { "name": "hiphop", "score": 0.5149 },
    { "name": "rap", "score": 0.3669 },
    { "name": "pop", "score": 0.2129 }
  ],
  "confidence": 0.5149,
  "modelVersion": "mtg_jamendo_genre-discogs-effnet-1",
  "status": "success",
  "errorMessage": null
}
```

## Run the backend

From `streaming-app-backend`:

```bash
npm install
npm run dev
```

Required backend env values:

- `DATABASE_URL`
- `JWT_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `AI_SERVICE_URL=http://127.0.0.1:8000`

## Upload a song and verify genre in DB

Upload route:

- `POST /api/songs/upload`

Form-data fields:

- `title`
- `uploaderGenre` optional fallback genre
- `audio`
- `image` optional

Flow:

1. backend uploads audio and image to Cloudinary
2. backend creates `Song` with `aiStatus = "pending"`
3. backend calls `POST /analyze/song`
4. backend updates:
   - `aiPrimaryGenre`
   - `aiGenresJson`
   - `finalPrimaryGenre`
   - `genreSource`
   - `genreConfidence`
   - `aiStatus`
   - `aiErrorMessage`
   - `aiModelVersion`

Fallback rules:

- AI success and confidence high enough: use AI
- AI fail and `uploaderGenre` exists: use uploader genre
- AI fail and no `uploaderGenre`: use `Other`

## Recommendation v1 demo

Routes used by the app:

- `GET /api/recommendations/for-you`
- `GET /api/recommendations/autoplay/:songId`
- `GET /api/recommendations/similar/:songId`

Recommendation v1 uses only:

- `Song.finalPrimaryGenre`
- `Song.playCount`
- `Song.likeCount`
- `PlayHistory`
- `Like`
- `PlaylistSong`
- `Repost`

Scoring formula:

```text
score_v1 =
  0.40 * content_score
+ 0.30 * collaborative_score
+ 0.20 * popularity_score
+ 0.10 * freshness_score
```

## Manual tools kept for demo

- `test_ai.py` for direct Essentia script-level testing
- `docs/postman/streaming-app-demo.postman_collection.json` for upload, analyze, and recommendation requests
- `docs/ai-demo-checklist.md` for the defense/demo sequence
