from fastapi import APIRouter

from app.schemas.recommend_schema import ProfileBuildRequest, ProfileBuildResponse
from app.services.user_profile_service import user_profile_service

router = APIRouter(prefix="/v1/profile", tags=["profile"])


@router.post("/rebuild", response_model=ProfileBuildResponse)
async def rebuild_profile(payload: ProfileBuildRequest) -> ProfileBuildResponse:
    return user_profile_service.build_profile(payload.userId, payload.interactions)
