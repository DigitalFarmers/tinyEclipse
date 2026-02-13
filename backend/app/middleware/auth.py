from fastapi import Header, HTTPException, Depends

from app.config import get_settings, Settings


async def verify_admin_key(
    x_admin_key: str = Header(..., alias="X-Admin-Key"),
    settings: Settings = Depends(get_settings),
) -> bool:
    """Verify the admin API key from request header."""
    if x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=403, detail="Invalid admin API key")
    return True
