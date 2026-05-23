# AI Demo Checklist

## Pre-demo

1. Start PostgreSQL and confirm backend env is loaded.
2. Start the AI service and confirm `GET /health` returns:
   - `essentiaImportOk = true`
   - all model files exist
   - `genre_labels_count = 87`
3. Start the Node backend.
4. Log in on the mobile app with a test account.

## Demo flow

1. Upload a song from the app or Postman with:
   - `title`
   - `audio`
   - `image` optional
   - `uploaderGenre` optional
2. Show the upload response contains:
   - `audioUrl`
   - `imageUrl`
   - `aiStatus`
   - `finalPrimaryGenre`
3. Open the `Song` row in PostgreSQL and show:
   - `aiPrimaryGenre`
   - `aiGenresJson`
   - `finalPrimaryGenre`
   - `genreSource`
   - `genreConfidence`
4. Play a few songs in the app to create `PlayHistory`.
5. Like one song and add one song to a playlist.
6. Refresh the Home screen and show `/api/recommendations/for-you` changed.
7. Let a song finish and show autoplay fetches `/api/recommendations/autoplay/:songId`.
8. Open a track detail or direct API call and show `/api/recommendations/similar/:songId`.

## Manual verification cases

### Genre analyze success

- AI service on
- upload a song
- expect:
  - `aiStatus = success`
  - `genreSource = ai`
  - `finalPrimaryGenre = aiPrimaryGenre`

### Genre analyze fail with uploader fallback

- stop AI service or force `/analyze/song` to fail
- upload with `uploaderGenre`
- expect:
  - `aiStatus = failed`
  - `genreSource = uploader`
  - `finalPrimaryGenre = uploaderGenre`

### Genre analyze fail with system fallback

- stop AI service
- upload without `uploaderGenre`
- expect:
  - `aiStatus = failed`
  - `genreSource = system`
  - `finalPrimaryGenre = Other`

### Recommendation cold start

- new user with no history
- expect home feed to fall back to popular and fresh songs

### Recommendation warm user

- user with `PlayHistory`, `Like`, and `PlaylistSong`
- expect home feed to shift toward listened genres
- expect autoplay and similar to stay in the same genre neighborhood
