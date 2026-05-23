Place the Essentia model assets in this directory before enabling genre inference.

Required files for the MVP pipeline:

- `discogs-effnet-bs64-1.pb`
- `discogs-effnet-bs64-1.json`
- `mtg_jamendo_genre-discogs-effnet-1.pb`
- `mtg_jamendo_genre-discogs-effnet-1.json`

Recommended runtime:

- Linux container or WSL Ubuntu
- `ESSENTIA_ENABLED=true`
- FastAPI service running from the `Dockerfile` in this folder

Day 3 readiness expectation:

- `GET /health` should report whether this directory exists
- it should also report whether each `.pb/.json` file exists
- classifier metadata should load and expose genre labels before you attempt real inference
