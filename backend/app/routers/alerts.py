"""
Alerts API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Body, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

from app.models.alerts import AlertRule, AlertNotification, AlertType, AlertSeverity, AlertStatus
from app.services.alert_engine import alert_engine
from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.post("/rules")
async def create_alert_rule(
    tenant_id: str = Body(...),
    name: str = Body(...),
    alert_type: AlertType = Body(...),
    conditions: Dict[str, Any] = Body(...),
    severity: AlertSeverity = Body(AlertSeverity.MEDIUM),
    description: Optional[str] = Body(None),
    is_enabled: bool = Body(True),
    notify_push: bool = Body(True),
    notify_email: bool = Body(False),
    cooldown_minutes: int = Body(60)
):
    """Create a new alert rule"""
    try:
        rule = await alert_engine.create_rule(
            tenant_id=tenant_id,
            name=name,
            alert_type=alert_type,
            conditions=conditions,
            severity=severity,
            description=description,
            is_enabled=is_enabled,
            notify_push=notify_push,
            notify_email=notify_email,
            cooldown_minutes=cooldown_minutes
        )
        return {"rule_id": str(rule.id), "status": "created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create rule: {str(e)}")


@router.get("/rules/{tenant_id}")
async def get_alert_rules(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Get all alert rules for a tenant"""
    rules = (await db.execute(
        select(AlertRule).where(AlertRule.tenant_id == tenant_id).order_by(AlertRule.created_at.desc())
    )).scalars().all()
    
    return {
            "rules": [
                {
                    "id": str(rule.id),
                    "name": rule.name,
                    "description": rule.description,
                    "alert_type": rule.alert_type,
                    "severity": rule.severity,
                    "conditions": rule.conditions,
                    "is_enabled": rule.is_enabled,
                    "notify_push": rule.notify_push,
                    "notify_email": rule.notify_email,
                    "cooldown_minutes": rule.cooldown_minutes,
                    "created_at": rule.created_at.isoformat()
                }
                for rule in rules
            ]
        }


@router.put("/rules/{rule_id}")
async def update_alert_rule(
    rule_id: str,
    updates: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db)
):
    """Update an alert rule"""
    rule = (await db.execute(select(AlertRule).where(AlertRule.id == rule_id))).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    # Update allowed fields
    allowed_fields = ['name', 'description', 'conditions', 'severity', 'is_enabled', 'notify_push', 'notify_email', 'cooldown_minutes']
    for field, value in updates.items():
        if field in allowed_fields and hasattr(rule, field):
            setattr(rule, field, value)
    
    rule.updated_at = datetime.now(timezone.utc)
    await db.commit()
    
    return {"status": "updated"}


@router.delete("/rules/{rule_id}")
async def delete_alert_rule(rule_id: str, db: AsyncSession = Depends(get_db)):
    """Delete an alert rule"""
    rule = (await db.execute(select(AlertRule).where(AlertRule.id == rule_id))).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    await db.delete(rule)
    await db.commit()
    
    return {"status": "deleted"}


@router.post("/trigger")
async def trigger_alert(
    tenant_id: str = Body(...),
    alert_type: AlertType = Body(...),
    title: str = Body(...),
    message: str = Body(...),
    context: Dict[str, Any] = Body(...),
    source_id: Optional[str] = Body(None),
    source_type: Optional[str] = Body(None),
    severity: Optional[AlertSeverity] = Body(None)
):
    """Manually trigger an alert"""
    try:
        alert = await alert_engine.trigger_alert(
            tenant_id=tenant_id,
            alert_type=alert_type,
            title=title,
            message=message,
            context=context,
            source_id=source_id,
            source_type=source_type,
            severity=severity
        )
        
        if alert:
            return {"alert_id": str(alert.id), "status": "triggered"}
        else:
            return {"status": "no_rules_matched"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to trigger alert: {str(e)}")


@router.get("/active/{tenant_id}")
async def get_active_alerts(tenant_id: str):
    """Get all active alerts for a tenant"""
    try:
        alerts = await alert_engine.get_active_alerts(tenant_id)
        
        return {
            "alerts": [
                {
                    "id": str(alert.id),
                    "title": alert.title,
                    "message": alert.message,
                    "alert_type": alert.alert_type,
                    "severity": alert.severity,
                    "status": alert.status,
                    "context": alert.context,
                    "source_id": alert.source_id,
                    "source_type": alert.source_type,
                    "triggered_at": alert.triggered_at.isoformat(),
                    "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
                    "acknowledged_by": alert.acknowledged_by
                }
                for alert in alerts
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get alerts: {str(e)}")


@router.post("/acknowledge/{alert_id}")
async def acknowledge_alert(alert_id: str, acknowledged_by: str = Body(...)):
    """Acknowledge an alert"""
    try:
        success = await alert_engine.acknowledge_alert(alert_id, acknowledged_by)
        if success:
            return {"status": "acknowledged"}
        else:
            raise HTTPException(status_code=404, detail="Alert not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to acknowledge alert: {str(e)}")


@router.post("/resolve/{alert_id}")
async def resolve_alert(
    alert_id: str,
    resolved_by: str = Body(...),
    note: Optional[str] = Body(None)
):
    """Resolve an alert"""
    try:
        success = await alert_engine.resolve_alert(alert_id, resolved_by, note)
        if success:
            return {"status": "resolved"}
        else:
            raise HTTPException(status_code=404, detail="Alert not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resolve alert: {str(e)}")


@router.get("/stats/{tenant_id}")
async def get_alert_stats(tenant_id: str):
    """Get alert statistics for a tenant"""
    with get_db_session() as db:
        # Get counts by status
        status_counts = {}
        for status in AlertStatus:
            count = db.execute(
                select(Alert).where(
                    and_(
                        Alert.tenant_id == tenant_id,
                        Alert.status == status
                    )
                )
            ).count()
            status_counts[status.value] = count
        
        # Get counts by type
        type_counts = {}
        for alert_type in AlertType:
            count = db.execute(
                select(Alert).where(
                    and_(
                        Alert.tenant_id == tenant_id,
                        Alert.alert_type == alert_type,
                        Alert.status.in_([AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED])
                    )
                )
            ).count()
            type_counts[alert_type.value] = count
        
        # Get recent alerts (last 24 hours)
        from datetime import timedelta
        recent_cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        recent_count = db.execute(
            select(Alert).where(
                and_(
                    Alert.tenant_id == tenant_id,
                    Alert.triggered_at >= recent_cutoff
                )
            )
        ).count()
        
        return {
            "status_counts": status_counts,
            "type_counts": type_counts,
            "recent_24h": recent_count,
            "active_count": status_counts.get("active", 0) + status_counts.get("acknowledged", 0)
        }


# Predefined alert templates
@router.get("/templates")
async def get_alert_templates():
    """Get predefined alert rule templates"""
    templates = {
        "abandoned_cart": {
            "name": "Abandoned Cart Alert",
            "alert_type": AlertType.ABANDONED_CART,
            "conditions": {"min_cart_value": 50},
            "severity": AlertSeverity.MEDIUM,
            "description": "Alert when a cart with value > €50 is abandoned"
        },
        "high_value_abandoned_cart": {
            "name": "High Value Abandoned Cart",
            "alert_type": AlertType.ABANDONED_CART,
            "conditions": {"min_cart_value": 200},
            "severity": AlertSeverity.HIGH,
            "description": "Alert when a cart with value > €200 is abandoned"
        },
        "checkout_failure": {
            "name": "Checkout Failure",
            "alert_type": AlertType.CHECKOUT_FAILURE,
            "conditions": {"min_cart_value": 25, "failure_types": ["payment_declined", "technical_error"]},
            "severity": AlertSeverity.HIGH,
            "description": "Alert when checkout fails for cart > €25"
        },
        "ssl_expiring": {
            "name": "SSL Certificate Expiring",
            "alert_type": AlertType.SSL_EXPIRING,
            "conditions": {"threshold_days": 30},
            "severity": AlertSeverity.HIGH,
            "description": "Alert when SSL certificate expires within 30 days"
        },
        "uptime_down": {
            "name": "Site Downtime",
            "alert_type": AlertType.UPTIME_DOWN,
            "conditions": {"min_duration_minutes": 5},
            "severity": AlertSeverity.CRITICAL,
            "description": "Alert when site is down for more than 5 minutes"
        },
        "high_value_order": {
            "name": "High Value Order",
            "alert_type": AlertType.HIGH_VALUE_ORDER,
            "conditions": {"min_order_value": 500},
            "severity": AlertSeverity.MEDIUM,
            "description": "Alert when order value exceeds €500"
        },
        "security_issue": {
            "name": "Security Issue Detected",
            "alert_type": AlertType.SECURITY_ISSUE,
            "conditions": {"min_severity": "high"},
            "severity": AlertSeverity.CRITICAL,
            "description": "Alert for high or critical security issues"
        }
    }
    
    return templates
