from fastapi import APIRouter
from starlette.concurrency import run_in_threadpool

from app.schemas.analyze_schema import AnalyzeSongRequest, AnalyzeSongResponse
from app.services.genre_tagging_service import genre_tagging_service

router = APIRouter(tags=["analyze"])


@router.post("/analyze/song", response_model=AnalyzeSongResponse)
@router.post("/v1/analyze/song", response_model=AnalyzeSongResponse, include_in_schema=False)
async def analyze_song(payload: AnalyzeSongRequest) -> AnalyzeSongResponse:
    return await run_in_threadpool(genre_tagging_service.analyze_song, payload)
