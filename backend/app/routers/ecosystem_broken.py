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
            
            # Find plugin of requested type
            target_plugin = None
            for slug, plugin_info in plugins.items():
                if plugin_info.get('type') == plugin_type:
                    target_plugin = plugin_info
                    break
            
            if not target_plugin:
                raise HTTPException(status_code=404, detail=f"No plugin found for type: {plugin_type}")
            
            # Simulate plugin action response
            result = {
                "plugin_type": plugin_type,
                "action": action,
                "plugin_slug": slug,
                "success": True,
                "data": f"Simulated {action} on {plugin_type} plugin",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            logger.info(f"Adapted to {plugin_type} plugin for tenant {tenant_id}: {action}")
            
            return result
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to adapt to plugin for {tenant_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to adapt to plugin: {str(e)}")


@router.get("/learning/patterns")
async def get_learning_patterns(limit: int = Query(100)):
    """Get learned patterns for ecosystem detection"""
    try:
        # This would return patterns learned from multiple sites
        # For now, return sample patterns
        patterns = {
            "plugin_combinations": {
                "woocommerce_fluentform": {
                    "confidence": 0.95,
                    "sites_count": 42,
                    "description": "E-commerce site with form management"
                },
                "fluentcrm_fluentform": {
                    "confidence": 0.88,
                    "sites_count": 28,
                    "description": "Marketing automation with lead capture"
                },
                "woocommerce_fluentcrm": {
                    "confidence": 0.82,
                    "sites_count": 15,
                    "description": "E-commerce with customer management"
                }
            },
            "common_integrations": {
                "stripe": {"sites_count": 38, "confidence": 0.91},
                "paypal": {"sites_count": 31, "confidence": 0.85},
                "mailchimp": {"sites_count": 22, "confidence": 0.78}
            },
            "theme_features": {
                "elementor": {"sites_count": 45, "confidence": 0.93},
                "divi": {"sites_count": 18, "confidence": 0.76},
                "avada": {"sites_count": 12, "confidence": 0.71}
            }
        }
        
        return {
            "success": True,
            "patterns": patterns,
            "total_patterns": sum(len(category) for category in patterns.values())
        }
        
    except Exception as e:
        logger.error(f"Failed to get learning patterns: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get learning patterns: {str(e)}")


@router.get("/stats/overview")
async def get_ecosystem_stats():
    """Get ecosystem detection statistics across all tenants"""
    try:
        with get_db_session() as db:
            tenants = db.execute(select(Tenant)).scalars().all()
            
            stats = {
                "total_tenants": len(tenants),
                "scanned_tenants": 0,
                "plugin_types": {},
                "popular_plugins": {},
                "average_confidence": 0,
                "integrations": {}
            }
            
            total_confidence = 0
            confidence_count = 0
            
            for tenant in tenants:
                ecosystem_data = tenant.settings.get('ecosystem', {})
                if ecosystem_data:
                    stats["scanned_tenants"] += 1
                    
                    # Count plugin types
                    plugin_types = tenant.settings.get('ecosystem_plugin_types', [])
                    for plugin_type in plugin_types:
                        stats["plugin_types"][plugin_type] = stats["plugin_types"].get(plugin_type, 0) + 1
                    
                    # Count popular plugins
                    plugins = ecosystem_data.get('plugins', {})
                    for plugin_slug in plugins.keys():
                        stats["popular_plugins"][plugin_slug] = stats["popular_plugins"].get(plugin_slug, 0) + 1
                    
                    # Calculate average confidence
                    confidence = tenant.settings.get('ecosystem_confidence', 0)
                    if confidence > 0:
                        total_confidence += confidence
                        confidence_count += 1
                    
                    # Count integrations
                    integrations = tenant.settings.get('ecosystem_integrations', {})
                    for integration in integrations.keys():
                        stats["integrations"][integration] = stats["integrations"].get(integration, 0) + 1
            
            if confidence_count > 0:
                stats["average_confidence"] = total_confidence / confidence_count
            
            return {
                "success": True,
                "stats": stats
            }
            
    except Exception as e:
        logger.error(f"Failed to get ecosystem stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get ecosystem stats: {str(e)}")
