import logging

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.middleware.rate_limit import limiter
from app.routers import chat, consent, tenants, sources, admin, monitoring, tracking, reports, webhooks, system, whmcs, portal_auth, events, portal_features, portal_projects, mail, module_events, portal_unified, client_profiles, portal_account, portal_conversations, wp_proxy, leads, contacts
from app.routers.insights import admin_router as insights_admin, portal_router as insights_portal
from app.routers.heartbeat import public_router as heartbeat_public, admin_router as heartbeat_admin
from app.routers.sites import public_router as sites_public, admin_router as sites_admin

settings = get_settings()

_LOG_LEVELS = {"DEBUG": logging.DEBUG, "INFO": logging.INFO, "WARNING": logging.WARNING, "ERROR": logging.ERROR, "CRITICAL": logging.CRITICAL}

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.ConsoleRenderer() if settings.log_level == "DEBUG" else structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(
        _LOG_LEVELS.get(settings.log_level.upper(), logging.INFO)
    ),
)

app = FastAPI(
    title="TinyEclipse API",
    description="AI Operating Layer — tenant-isolated, confidence-scored, human-first",
    version="0.1.0",
    redirect_slashes=False,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(chat.router)
app.include_router(consent.router)
app.include_router(tenants.router)
app.include_router(sources.router)
app.include_router(admin.router)
app.include_router(monitoring.router)
app.include_router(tracking.router)
app.include_router(reports.router)
app.include_router(webhooks.router)
app.include_router(system.router)
app.include_router(heartbeat_public)
app.include_router(heartbeat_admin)
app.include_router(sites_public)
app.include_router(sites_admin)
app.include_router(whmcs.router)
app.include_router(portal_auth.router)
app.include_router(events.router)
app.include_router(portal_features.router)
app.include_router(portal_projects.router)
app.include_router(mail.router)
app.include_router(module_events.router)
app.include_router(portal_unified.router)
app.include_router(client_profiles.router)
app.include_router(portal_account.router)
app.include_router(portal_conversations.router)
app.include_router(wp_proxy.router)
app.include_router(leads.public_router)
app.include_router(leads.admin_router)
app.include_router(contacts.router)
app.include_router(insights_admin)
app.include_router(insights_portal)

# Serve widget static files
try:
    app.mount("/widget/v1", StaticFiles(directory="static/widget/v1"), name="widget")
except Exception:
    pass  # Widget not built yet


@app.on_event("startup")
async def startup_event():
    from app.services.scheduler import start_scheduler
    start_scheduler()


@app.on_event("shutdown")
async def shutdown_event():
    from app.services.scheduler import stop_scheduler
    stop_scheduler()


@app.get("/")
async def root():
    return {
        "name": "TinyEclipse API",
        "version": "0.1.0",
        "status": "running",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
