"""
Plan Limits — Feature gating per plan tier.

TINY (gratis bij hosting):
  - AI chat: max 50 berichten/maand
  - Kennisbank: max 5 pagina's
  - Monitoring: basis uptime check alleen
  - Analytics: geen
  - Events feed: laatste 24u alleen
  - Push notifications: nee

PRO (betaald):
  - AI chat: max 500 berichten/maand
  - Kennisbank: max 50 pagina's
  - Monitoring: uptime + SSL + DNS
  - Analytics: basis (sessies, pageviews)
  - Events feed: 7 dagen
  - Push notifications: ja
  - Proactive help: ja

PRO+ (premium):
  - AI chat: onbeperkt
  - Kennisbank: onbeperkt
  - Monitoring: alles (uptime, SSL, DNS, performance, server)
  - Analytics: volledig (+ conversie tracking)
  - Events feed: 30 dagen
  - Push notifications: ja + prioriteit
  - Proactive help: ja
  - Server monitoring: Imunify, SMTP, DirectAdmin
  - Dedicated support
"""

from dataclasses import dataclass
from typing import Dict


@dataclass
class PlanFeatures:
    # Chat
    monthly_chat_limit: int
    knowledge_pages_limit: int

    # Monitoring
    monitoring_uptime: bool
    monitoring_ssl: bool
    monitoring_dns: bool
    monitoring_performance: bool
    monitoring_server: bool  # Imunify, SMTP, DirectAdmin

    # Analytics
    analytics_basic: bool  # Sessions, pageviews
    analytics_advanced: bool  # Conversions, funnels, heatmaps

    # Events
    events_max_hours: int  # How far back events feed goes

    # Features
    proactive_help: bool
    push_notifications: bool
    priority_support: bool
    custom_branding: bool  # Remove "Powered by TinyEclipse"

    # Label
    label: str
    price_label: str


PLAN_FEATURES: Dict[str, PlanFeatures] = {
    "tiny": PlanFeatures(
        monthly_chat_limit=50,
        knowledge_pages_limit=5,
        monitoring_uptime=True,
        monitoring_ssl=False,
        monitoring_dns=False,
        monitoring_performance=False,
        monitoring_server=False,
        analytics_basic=False,
        analytics_advanced=False,
        events_max_hours=24,
        proactive_help=False,
        push_notifications=False,
        priority_support=False,
        custom_branding=False,
        label="Tiny",
        price_label="Gratis bij je hosting",
    ),
    "pro": PlanFeatures(
        monthly_chat_limit=500,
        knowledge_pages_limit=50,
        monitoring_uptime=True,
        monitoring_ssl=True,
        monitoring_dns=True,
        monitoring_performance=False,
        monitoring_server=False,
        analytics_basic=True,
        analytics_advanced=False,
        events_max_hours=168,  # 7 days
        proactive_help=True,
        push_notifications=True,
        priority_support=False,
        custom_branding=False,
        label="Pro",
        price_label="€9,99/maand",
    ),
    "pro_plus": PlanFeatures(
        monthly_chat_limit=999999,  # Unlimited
        knowledge_pages_limit=999999,
        monitoring_uptime=True,
        monitoring_ssl=True,
        monitoring_dns=True,
        monitoring_performance=True,
        monitoring_server=True,
        analytics_basic=True,
        analytics_advanced=True,
        events_max_hours=720,  # 30 days
        proactive_help=True,
        push_notifications=True,
        priority_support=True,
        custom_branding=True,
        label="Pro+",
        price_label="€24,99/maand",
    ),
}


def get_plan_features(plan: str) -> PlanFeatures:
    """Get features for a plan. Defaults to tiny if unknown."""
    return PLAN_FEATURES.get(plan, PLAN_FEATURES["tiny"])


def check_feature(plan: str, feature: str) -> bool:
    """Check if a specific feature is available for a plan."""
    features = get_plan_features(plan)
    return getattr(features, feature, False)


def get_plan_comparison() -> list[dict]:
    """Get a comparison table of all plans for the frontend."""
    result = []
    for plan_key, f in PLAN_FEATURES.items():
        result.append({
            "plan": plan_key,
            "label": f.label,
            "price": f.price_label,
            "features": {
                "AI Chat": f"{f.monthly_chat_limit} berichten/maand" if f.monthly_chat_limit < 999999 else "Onbeperkt",
                "Kennisbank": f"{f.knowledge_pages_limit} pagina's" if f.knowledge_pages_limit < 999999 else "Onbeperkt",
                "Uptime Monitoring": f.monitoring_uptime,
                "SSL Monitoring": f.monitoring_ssl,
                "DNS Monitoring": f.monitoring_dns,
                "Performance Monitoring": f.monitoring_performance,
                "Server Monitoring": f.monitoring_server,
                "Bezoekers Analytics": f.analytics_basic,
                "Geavanceerde Analytics": f.analytics_advanced,
                "Activiteit Feed": f"{f.events_max_hours}u" if f.events_max_hours < 720 else "30 dagen",
                "Proactieve Help": f.proactive_help,
                "Push Notificaties": f.push_notifications,
                "Prioriteit Support": f.priority_support,
                "Eigen Branding": f.custom_branding,
            },
        })
    return result
