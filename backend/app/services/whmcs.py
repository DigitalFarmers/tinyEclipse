"""
WHMCS Integration Service — The bridge between billing and Eclipse.
Handles client sync, order provisioning, SSO, and product mapping.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class WHMCSError(Exception):
    """WHMCS API error."""
    pass


class WHMCSClient:
    """Async WHMCS API client."""

    def __init__(self):
        self.api_url = settings.whmcs_api_url
        self.identifier = settings.whmcs_api_identifier
        self.secret = settings.whmcs_api_secret
        self.admin_user = settings.whmcs_admin_user

    @property
    def configured(self) -> bool:
        return bool(self.api_url and self.identifier and self.secret)

    async def _call(self, action: str, **params) -> dict:
        """Make an authenticated WHMCS API call."""
        if not self.configured:
            raise WHMCSError("WHMCS not configured — set WHMCS_API_URL, WHMCS_API_IDENTIFIER, WHMCS_API_SECRET")

        payload = {
            "identifier": self.identifier,
            "secret": self.secret,
            "action": action,
            "responsetype": "json",
            **params,
        }

        # Some actions require adminuser
        if self.admin_user:
            payload["adminuser"] = self.admin_user

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.api_url, data=payload)
                resp.raise_for_status()
                data = resp.json()

            if data.get("result") == "error":
                raise WHMCSError(f"WHMCS API error: {data.get('message', 'Unknown')}")

            return data

        except httpx.HTTPError as e:
            raise WHMCSError(f"WHMCS HTTP error: {e}")

    # ─── Clients ───

    async def get_clients(self, limit: int = 250, offset: int = 0) -> dict:
        """Get all clients."""
        return await self._call("GetClients", limitstart=offset, limitnum=limit)

    async def get_client(self, client_id: int) -> dict:
        """Get a single client by ID."""
        return await self._call("GetClientsDetails", clientid=client_id)

    async def search_clients(self, search: str) -> dict:
        """Search clients by name, email, or company."""
        return await self._call("GetClients", search=search)

    async def get_client_products(self, client_id: int) -> dict:
        """Get all products/services for a client."""
        return await self._call("GetClientsProducts", clientid=client_id)

    async def get_client_domains(self, client_id: int) -> dict:
        """Get all domains for a client."""
        return await self._call("GetClientsDomains", clientid=client_id)

    # ─── Products ───

    async def get_products(self) -> dict:
        """Get all products/product groups."""
        return await self._call("GetProducts")

    async def get_orders(self, limit: int = 100) -> dict:
        """Get recent orders."""
        return await self._call("GetOrders", limitnum=limit)

    # ─── Invoices ───

    async def get_invoices(self, client_id: Optional[int] = None, status: str = "Unpaid") -> dict:
        """Get invoices, optionally filtered by client and status."""
        params = {"status": status}
        if client_id:
            params["userid"] = client_id
        return await self._call("GetInvoices", **params)

    async def get_invoice(self, invoice_id: int) -> dict:
        """Get a single invoice."""
        return await self._call("GetInvoice", invoiceid=invoice_id)

    # ─── Tickets ───

    async def get_tickets(self, client_id: Optional[int] = None, status: str = "Open") -> dict:
        """Get support tickets."""
        params = {"status": status}
        if client_id:
            params["clientid"] = client_id
        return await self._call("GetTickets", **params)

    async def create_ticket(
        self, client_id: int, department_id: int, subject: str, message: str, priority: str = "Medium"
    ) -> dict:
        """Create a support ticket."""
        return await self._call(
            "OpenTicket",
            clientid=client_id,
            deptid=department_id,
            subject=subject,
            message=message,
            priority=priority,
        )

    # ─── SSO (Single Sign-On) ───

    async def create_sso_token(self, client_id: int) -> dict:
        """Create an SSO token for a client to auto-login to WHMCS client area."""
        return await self._call("CreateSsoToken", client_id=client_id)

    # ─── Module Commands ───

    async def module_create(self, service_id: int) -> dict:
        """Trigger module create for a service (provision hosting)."""
        return await self._call("ModuleCreate", serviceid=service_id)

    async def module_suspend(self, service_id: int) -> dict:
        """Suspend a service."""
        return await self._call("ModuleSuspend", serviceid=service_id)

    async def module_unsuspend(self, service_id: int) -> dict:
        """Unsuspend a service."""
        return await self._call("ModuleUnsuspend", serviceid=service_id)

    async def module_terminate(self, service_id: int) -> dict:
        """Terminate a service."""
        return await self._call("ModuleTerminate", serviceid=service_id)

    # ─── Custom Fields ───

    async def update_client_custom_field(self, service_id: int, field_name: str, value: str) -> dict:
        """Update a custom field on a client's service."""
        return await self._call(
            "UpdateClientProduct",
            serviceid=service_id,
            customfields=f"{field_name}|{value}",
        )

    # ─── Plan Mapping ───

    def product_id_to_plan(self, product_id: int) -> Optional[str]:
        """Map WHMCS product ID to Eclipse plan name."""
        mapping = {
            settings.whmcs_product_tiny: "tiny",
            settings.whmcs_product_pro: "pro",
            settings.whmcs_product_pro_plus: "pro_plus",
        }
        return mapping.get(product_id)

    def plan_to_product_id(self, plan: str) -> Optional[int]:
        """Map Eclipse plan name to WHMCS product ID."""
        mapping = {
            "tiny": settings.whmcs_product_tiny,
            "pro": settings.whmcs_product_pro,
            "pro_plus": settings.whmcs_product_pro_plus,
        }
        pid = mapping.get(plan)
        return pid if pid and pid > 0 else None

    # ─── Health Check ───

    async def health_check(self) -> dict:
        """Check if WHMCS API is reachable and credentials work."""
        if not self.configured:
            return {"status": "not_configured", "message": "WHMCS credentials not set"}

        try:
            result = await self._call("GetAdminDetails")
            return {
                "status": "healthy",
                "admin_user": result.get("adminuser"),
                "whmcs_version": result.get("whmcsversion"),
            }
        except WHMCSError as e:
            return {"status": "error", "message": str(e)}
        except Exception as e:
            return {"status": "error", "message": str(e)}


# Singleton
_whmcs_client: Optional[WHMCSClient] = None


def get_whmcs_client() -> WHMCSClient:
    global _whmcs_client
    if _whmcs_client is None:
        _whmcs_client = WHMCSClient()
    return _whmcs_client
