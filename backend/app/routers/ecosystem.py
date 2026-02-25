"""
Ecosystem Detection API Endpoints - Backend API for WordPress ecosystem detection
"""
from fastapi import APIRouter, Depends, HTTPException, Body, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import logging

from app.database import get_db
from app.models.tenant import Tenant
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

router = APIRouter(prefix="/api/ecosystem", tags=["ecosystem"])
logger = logging.getLogger(__name__)


@router.post("/scan/{tenant_id}")
async def receive_ecosystem_scan(tenant_id: str, ecosystem_data: Dict[str, Any], db: AsyncSession = Depends(get_db)):
    """Receive ecosystem scan data from WordPress site"""
    try:
        # Get tenant
        tenant = (await db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )).first()
        
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        # Store ecosystem data in settings (no new database!)
        if not tenant.settings:
            tenant.settings = {}
        
        tenant.settings['ecosystem'] = ecosystem_data
        tenant.settings['ecosystem_last_scan'] = datetime.now(timezone.utc).isoformat()
        tenant.settings['ecosystem_confidence'] = ecosystem_data.get('confidence_score', 0)
        
        await db.commit()
        
        # Extract plugin types for quick access
        plugin_types = set()
        plugins = ecosystem_data.get('plugins', {})
        for plugin_slug, plugin_info in plugins.items():
            plugin_types.add(plugin_info.get('type', 'unknown'))
        
        tenant.settings['ecosystem_plugin_types'] = list(plugin_types)
        tenant.settings['ecosystem_capabilities'] = ecosystem_data.get('capabilities', {})
        tenant.settings['ecosystem_endpoints'] = ecosystem_data.get('endpoints', {})
        tenant.settings['ecosystem_integrations'] = ecosystem_data.get('integrations', {})
        
        logger.info(f"Received ecosystem scan for tenant {tenant_id}: {len(plugins)} plugins detected")
        
        return {
            "success": True,
            "tenant_id": tenant_id,
            "plugin_count": len(plugins),
            "confidence_score": ecosystem_data.get('confidence_score', 0),
            "plugin_types": list(plugin_types)
        }
        
    except Exception as e:
        logger.error(f"Failed to process ecosystem scan for tenant {tenant_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process scan: {str(e)}")


@router.get("/status/{tenant_id}")
async def get_ecosystem_status(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Get ecosystem status for a tenant"""
    try:
        tenant = (await db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )).first()
        
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        ecosystem_data = tenant.settings.get('ecosystem', {}) if tenant.settings else {}
        
        return {
            "tenant_id": tenant_id,
            "has_ecosystem_data": bool(ecosystem_data),
            "last_scan": tenant.settings.get('ecosystem_last_scan') if tenant.settings else None,
            "confidence_score": ecosystem_data.get('confidence_score', 0),
            "plugin_count": len(ecosystem_data.get('plugins', {})),
            "plugin_types": tenant.settings.get('ecosystem_plugin_types', []) if tenant.settings else [],
            "capabilities": ecosystem_data.get('capabilities', {}),
            "endpoints": ecosystem_data.get('endpoints', {}),
            "integrations": ecosystem_data.get('integrations', {})
        }
        
    except Exception as e:
        logger.error(f"Failed to get ecosystem status for tenant {tenant_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")


@router.get("/plugins/{tenant_id}")
async def get_ecosystem_plugins(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Get detailed plugin information for a tenant"""
    try:
        tenant = (await db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )).first()
        
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        ecosystem_data = tenant.settings.get('ecosystem', {}) if tenant.settings else {}
        plugins = ecosystem_data.get('plugins', {})
        
        return {
            "tenant_id": tenant_id,
            "plugins": plugins,
            "total_count": len(plugins),
            "active_count": len([p for p in plugins.values() if p.get('status') == 'active']),
            "last_scan": tenant.settings.get('ecosystem_last_scan') if tenant.settings else None
        }
        
    except Exception as e:
        logger.error(f"Failed to get ecosystem plugins for tenant {tenant_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get plugins: {str(e)}")


@router.get("/capabilities/{tenant_id}")
async def get_ecosystem_capabilities(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Get ecosystem capabilities for a tenant"""
    try:
        tenant = (await db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )).first()
        
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        ecosystem_data = tenant.settings.get('ecosystem', {}) if tenant.settings else {}
        
        return {
            "tenant_id": tenant_id,
            "capabilities": ecosystem_data.get('capabilities', {}),
            "endpoints": ecosystem_data.get('endpoints', {}),
            "integrations": ecosystem_data.get('integrations', {}),
            "last_scan": tenant.settings.get('ecosystem_last_scan') if tenant.settings else None
        }
        
    except Exception as e:
        logger.error(f"Failed to get ecosystem capabilities for tenant {tenant_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get capabilities: {str(e)}")


@router.post("/trigger-scan/{tenant_id}")
async def trigger_ecosystem_scan(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Trigger ecosystem scan for a tenant (returns scan URL for WordPress site)"""
    try:
        tenant = (await db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )).first()
        
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        if not tenant.domain:
            raise HTTPException(status_code=400, detail="Tenant has no domain configured")
        
        scan_url = f"https://{tenant.domain}/wp-json/tinyeclipse/v1/ecosystem/scan"
        
        return {
            "tenant_id": tenant_id,
            "scan_url": scan_url,
            "domain": tenant.domain,
            "message": "Send POST request to scan_url with ecosystem data"
        }
        
    except Exception as e:
        logger.error(f"Failed to trigger ecosystem scan for tenant {tenant_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to trigger scan: {str(e)}")
