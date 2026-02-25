"""
Alert Rules Engine Service - Manages alert rules and triggers
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any, Type
from sqlalchemy.orm import Session
from sqlalchemy import select, update, and_, or_

from app.models.alerts import AlertRule, ProactiveAlert, AlertType, AlertSeverity, AlertStatus, AlertNotification
from app.models.push_notifications import PushPayload
from app.services.push_service import push_service
from app.database import async_session
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class AlertEngine:
    """Engine for processing alert rules and triggering notifications"""
    
    def __init__(self):
        self.rule_processors = {
            AlertType.ABANDONED_CART: self._process_abandoned_cart,
            AlertType.CHECKOUT_FAILURE: self._process_checkout_failure,
            AlertType.SSL_EXPIRING: self._process_ssl_expiring,
            AlertType.UPTIME_DOWN: self._process_uptime_down,
            AlertType.FORM_SUBMISSION: self._process_form_submission,
            AlertType.HIGH_VALUE_ORDER: self._process_high_value_order,
            AlertType.NEW_ORDER: self._process_new_order,
            AlertType.SECURITY_ISSUE: self._process_security_issue,
        }
    
    async def create_rule(
        self,
        tenant_id: str,
        name: str,
        alert_type: AlertType,
        conditions: Dict[str, Any],
        severity: AlertSeverity = AlertSeverity.MEDIUM,
        **kwargs
    ) -> AlertRule:
        """Create a new alert rule"""
        async with async_session() as db:
            rule = AlertRule(
                tenant_id=tenant_id,
                name=name,
                alert_type=alert_type,
                severity=severity,
                conditions=conditions,
                **kwargs
            )
            db.add(rule)
            await db.commit()
            await db.refresh(rule)
            return rule
    
    async def trigger_alert(
        self,
        tenant_id: str,
        alert_type: AlertType,
        title: str,
        message: str,
        context: Dict[str, Any],
        source_id: Optional[str] = None,
        source_type: Optional[str] = None,
        severity: Optional[AlertSeverity] = None
    ) -> Optional[ProactiveAlert]:
        """Trigger an alert based on rules"""
        async with async_session() as db:
            # Get active rules for this alert type
            rules = await db.execute(
                select(AlertRule).where(
                    and_(
                        AlertRule.tenant_id == tenant_id,
                        AlertRule.alert_type == alert_type,
                        AlertRule.is_enabled == True
                    )
                )
            ).scalars().all()
            
            if not rules:
                logger.info(f"No active rules found for alert type {alert_type} in tenant {tenant_id}")
                return None
            
            # Check cooldown periods
            active_rules = []
            for rule in rules:
                # Check if similar alert was recently triggered
                recent_alert = await db.execute(
                    select(ProactiveAlert).where(
                        and_(
                            ProactiveAlert.tenant_id == tenant_id,
                            ProactiveAlert.rule_id == rule.id,
                            ProactiveAlert.alert_type == alert_type,
                            ProactiveAlert.triggered_at > datetime.now(timezone.utc) - timedelta(minutes=rule.cooldown_minutes)
                        )
                    )
                ).first()
                
                if not recent_alert:
                    active_rules.append(rule)
            
            if not active_rules:
                logger.info(f"All rules for alert type {alert_type} are in cooldown period")
                return None
            
            # Create alert for each active rule
            alerts = []
            for rule in active_rules:
                # Check if rule conditions are met
                if await self._evaluate_conditions(rule, context):
                    alert = ProactiveAlert(
                        tenant_id=tenant_id,
                        rule_id=rule.id,
                        title=title,
                        message=message,
                        alert_type=alert_type,
                        severity=severity or rule.severity,
                        context=context,
                        source_id=source_id,
                        source_type=source_type
                    )
                    db.add(alert)
                    alerts.append(alert)
            
            if alerts:
                await db.commit()
                
                # Send notifications
                for alert in alerts:
                    await self._send_notifications(alert, db)
                
                return alerts[0]  # Return first alert
            
            return None
    
    async def _evaluate_conditions(self, rule: AlertRule, context: Dict[str, Any]) -> bool:
        """Evaluate if alert conditions are met"""
        conditions = rule.conditions
        
        # Get the appropriate processor
        processor = self.rule_processors.get(rule.alert_type)
        if processor:
            return await processor(rule, context, conditions)
        
        # Default condition evaluation
        if rule.threshold_value is not None and rule.threshold_operator:
            value = context.get('value')
            if value is not None:
                return self._compare_values(float(value), float(rule.threshold_value), rule.threshold_operator)
        
        return True
    
    def _compare_values(self, actual: float, threshold: float, operator: str) -> bool:
        """Compare values based on operator"""
        if operator == '>':
            return actual > threshold
        elif operator == '<':
            return actual < threshold
        elif operator == '>=':
            return actual >= threshold
        elif operator == '<=':
            return actual <= threshold
        elif operator == '=':
            return actual == threshold
        return False
    
    async def _send_notifications(self, alert: ProactiveAlert, db: AsyncSession):
        """Send notifications for an alert"""
        rule = alert.rule
        
        if not rule or not rule.is_enabled:
            return
        
        # Create push notification payload
        if rule.notify_push:
            payload = PushPayload(
                title=f"[{alert.severity.upper()}] {alert.title}",
                body=alert.message,
                tag=f"alert-{alert.alert_type}",
                data={
                    "alert_id": str(alert.id),
                    "alert_type": alert.alert_type,
                    "severity": alert.severity,
                    "source_id": alert.source_id,
                    "source_type": alert.source_type
                },
                require_interaction=alert.severity in [AlertSeverity.HIGH, AlertSeverity.CRITICAL]
            )
            
            # Send to tenant admins
            await push_service.send_to_tenant_admins(alert.tenant_id, payload)
        
        # Log notifications
        if rule.notify_push:
            notification = AlertNotification(
                alert_id=alert.id,
                channel="push",
                recipient="tenant_admins",
                status="sent"
            )
            db.add(notification)
        
        await db.commit()
    
    # Rule processors for different alert types
    async def _process_abandoned_cart(self, rule: AlertRule, context: Dict[str, Any], conditions: Dict[str, Any]) -> bool:
        """Process abandoned cart alert"""
        cart_value = context.get('cart_value', 0)
        min_value = conditions.get('min_cart_value', 50)
        
        return cart_value >= min_value
    
    async def _process_checkout_failure(self, rule: AlertRule, context: Dict[str, Any], conditions: Dict[str, Any]) -> bool:
        """Process checkout failure alert"""
        failure_type = context.get('failure_type')
        cart_value = context.get('cart_value', 0)
        min_value = conditions.get('min_cart_value', 25)
        
        # Check cart value threshold
        if cart_value < min_value:
            return False
        
        # Check failure type if specified
        allowed_types = conditions.get('failure_types', ['payment_declined', 'technical_error'])
        return failure_type in allowed_types
    
    async def _process_ssl_expiring(self, rule: AlertRule, context: Dict[str, Any], conditions: Dict[str, Any]) -> bool:
        """Process SSL expiration alert"""
        days_until_expiry = context.get('days_until_expiry', 999)
        threshold_days = conditions.get('threshold_days', 30)
        
        return days_until_expiry <= threshold_days
    
    async def _process_uptime_down(self, rule: AlertRule, context: Dict[str, Any], conditions: Dict[str, Any]) -> bool:
        """Process uptime down alert"""
        is_down = context.get('is_down', False)
        duration_minutes = context.get('duration_minutes', 0)
        min_duration = conditions.get('min_duration_minutes', 5)
        
        return is_down and duration_minutes >= min_duration
    
    async def _process_form_submission(self, rule: AlertRule, context: Dict[str, Any], conditions: Dict[str, Any]) -> bool:
        """Process form submission alert"""
        form_type = context.get('form_type')
        priority = context.get('priority', 'normal')
        
        # Check if high priority
        if conditions.get('high_priority_only', False):
            return priority == 'high'
        
        # Check specific form types
        allowed_types = conditions.get('form_types', ['contact', 'quote'])
        return form_type in allowed_types
    
    async def _process_high_value_order(self, rule: AlertRule, context: Dict[str, Any], conditions: Dict[str, Any]) -> bool:
        """Process high value order alert"""
        order_value = context.get('order_value', 0)
        min_value = conditions.get('min_order_value', 500)
        
        return order_value >= min_value
    
    async def _process_new_order(self, rule: AlertRule, context: Dict[str, Any], conditions: Dict[str, Any]) -> bool:
        """Process new order alert"""
        # Always trigger for new orders (can be filtered by conditions)
        return True
    
    async def _process_security_issue(self, rule: AlertRule, context: Dict[str, Any], conditions: Dict[str, Any]) -> bool:
        """Process security issue alert"""
        issue_type = context.get('issue_type')
        severity = context.get('severity', 'medium')
        
        # Check severity threshold
        min_severity = conditions.get('min_severity', 'medium')
        severity_levels = {'low': 1, 'medium': 2, 'high': 3, 'critical': 4}
        
        return severity_levels.get(severity, 0) >= severity_levels.get(min_severity, 0)
    
    async def acknowledge_alert(self, alert_id: str, acknowledged_by: str) -> bool:
        """Acknowledge an alert"""
        async with async_session() as db:
            alert = (await db.execute(select(ProactiveAlert).where(ProactiveAlert.id == alert_id))).scalars().first()
            if alert:
                alert.status = AlertStatus.ACKNOWLEDGED
                alert.acknowledged_at = datetime.now(timezone.utc)
                alert.acknowledged_by = acknowledged_by
                await db.commit()
                return True
            return False
    
    async def resolve_alert(self, alert_id: str, resolved_by: str, note: Optional[str] = None) -> bool:
        """Resolve an alert"""
        async with async_session() as db:
            alert = (await db.execute(select(ProactiveAlert).where(ProactiveAlert.id == alert_id))).scalars().first()
            if alert:
                alert.status = AlertStatus.RESOLVED
                alert.resolved_at = datetime.now(timezone.utc)
                alert.resolved_by = resolved_by
                alert.resolution_note = note
                await db.commit()
                return True
            return False
    
    async def get_active_alerts(self, tenant_id: str) -> List[ProactiveAlert]:
        """Get all active alerts for a tenant"""
        async with async_session() as db:
            return (await db.execute(
                select(ProactiveAlert).where(
                    and_(
                        ProactiveAlert.tenant_id == tenant_id,
                        ProactiveAlert.status.in_([AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED])
                    )
                ).order_by(ProactiveAlert.triggered_at.desc())
            )).scalars().all()


# Global alert engine instance
alert_engine = AlertEngine()
