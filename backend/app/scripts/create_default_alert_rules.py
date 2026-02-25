"""
Create default alert rules for proactive notifications
"""
import asyncio
import logging
from app.services.alert_engine import alert_engine
from app.models.alerts import AlertType, AlertSeverity

logger = logging.getLogger(__name__)


async def create_default_alert_rules(tenant_id: str):
    """Create default alert rules for a new tenant"""
    
    default_rules = [
        {
            "name": "Abandoned Cart Alert",
            "alert_type": AlertType.ABANDONED_CART,
            "conditions": {"min_cart_value": 50},
            "severity": AlertSeverity.MEDIUM,
            "description": "Alert when a cart with value > €50 is abandoned",
            "cooldown_minutes": 60
        },
        {
            "name": "High Value Abandoned Cart",
            "alert_type": AlertType.ABANDONED_CART,
            "conditions": {"min_cart_value": 200},
            "severity": AlertSeverity.HIGH,
            "description": "Alert when a cart with value > €200 is abandoned",
            "cooldown_minutes": 30
        },
        {
            "name": "Checkout Failure",
            "alert_type": AlertType.CHECKOUT_FAILURE,
            "conditions": {"min_cart_value": 25, "failure_types": ["payment_declined", "technical_error"]},
            "severity": AlertSeverity.HIGH,
            "description": "Alert when checkout fails for cart > €25",
            "cooldown_minutes": 15
        },
        {
            "name": "SSL Certificate Expiring",
            "alert_type": AlertType.SSL_EXPIRING,
            "conditions": {"threshold_days": 30},
            "severity": AlertSeverity.HIGH,
            "description": "Alert when SSL certificate expires within 30 days",
            "cooldown_minutes": 1440  # 24 hours
        },
        {
            "name": "Site Downtime",
            "alert_type": AlertType.UPTIME_DOWN,
            "conditions": {"min_duration_minutes": 5},
            "severity": AlertSeverity.CRITICAL,
            "description": "Alert when site is down for more than 5 minutes",
            "cooldown_minutes": 10
        },
        {
            "name": "High Value Order",
            "alert_type": AlertType.HIGH_VALUE_ORDER,
            "conditions": {"min_order_value": 500},
            "severity": AlertSeverity.MEDIUM,
            "description": "Alert when order value exceeds €500",
            "cooldown_minutes": 5
        },
        {
            "name": "Security Issue Detected",
            "alert_type": AlertType.SECURITY_ISSUE,
            "conditions": {"min_severity": "high"},
            "severity": AlertSeverity.CRITICAL,
            "description": "Alert for high or critical security issues",
            "cooldown_minutes": 30
        },
        {
            "name": "Form Submission",
            "alert_type": AlertType.FORM_SUBMISSION,
            "conditions": {"high_priority_only": True, "form_types": ["contact", "quote"]},
            "severity": AlertSeverity.LOW,
            "description": "Alert for high-priority form submissions",
            "cooldown_minutes": 5
        }
    ]
    
    created_rules = []
    for rule_config in default_rules:
        try:
            rule = await alert_engine.create_rule(
                tenant_id=tenant_id,
                **rule_config
            )
            created_rules.append(rule)
            logger.info(f"Created default alert rule: {rule.name} for tenant {tenant_id}")
        except Exception as e:
            logger.error(f"Failed to create alert rule {rule_config['name']}: {e}")
    
    return created_rules


if __name__ == "__main__":
    # Example usage
    tenant_id = "e71307b8-a263-4a0f-bdb5-64060fcd84d1"  # Chocotale tenant
    asyncio.run(create_default_alert_rules(tenant_id))
