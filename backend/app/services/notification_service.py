"""
SYNAPSE — Notification Service
Handles sending review alerts and approval requests to Telegram and WhatsApp.
"""
from __future__ import annotations

from typing import Optional
import httpx
import structlog

from app.config import settings
from app.schemas import ReviewSummary

logger = structlog.get_logger(__name__)


class NotificationService:
    def __init__(self) -> None:
        self.client = httpx.AsyncClient(timeout=10.0)

    async def close(self) -> None:
        await self.client.aclose()

    async def send_telegram_message(self, text: str) -> bool:
        """Send a markdown message to the configured Telegram chat."""
        token = getattr(settings, "telegram_bot_token", None)
        chat_id = getattr(settings, "telegram_chat_id", None)

        if not token or not chat_id:
            logger.debug("Telegram notifications skipped: credentials not configured")
            return False

        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown",
        }

        try:
            response = await self.client.post(url, json=payload)
            if response.status_code == 200:
                logger.info("Telegram notification sent successfully")
                return True
            else:
                logger.error(
                    "Failed to send Telegram notification",
                    status_code=response.status_code,
                    response=response.text,
                )
                return False
        except Exception as exc:
            logger.error("Error sending Telegram notification", error=str(exc))
            return False

    async def send_whatsapp_message(self, text: str) -> bool:
        """Send a message via WhatsApp Cloud API to the configured recipient."""
        phone_number_id = getattr(settings, "whatsapp_phone_number_id", None)
        access_token = getattr(settings, "whatsapp_access_token", None)
        recipient = getattr(settings, "whatsapp_recipient_number", None)

        if not phone_number_id or not access_token or not recipient:
            logger.debug("WhatsApp notifications skipped: credentials not configured")
            return False

        # Clean recipient phone number (must be in E.164 format without +)
        to_number = "".join(filter(str.isdigit, recipient))

        url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        payload = {
            "messaging_product": "whatsapp",
            "to": to_number,
            "type": "text",
            "text": {"body": text},
        }

        try:
            response = await self.client.post(url, headers=headers, json=payload)
            if response.status_code in (200, 201):
                logger.info("WhatsApp notification sent successfully")
                return True
            else:
                logger.error(
                    "Failed to send WhatsApp notification",
                    status_code=response.status_code,
                    response=response.text,
                )
                return False
        except Exception as exc:
            logger.error("Error sending WhatsApp notification", error=str(exc))
            return False

    async def notify_review_status(
        self,
        session_id: str,
        title: str,
        status: str,
        summary: Optional[ReviewSummary] = None,
        narrative: Optional[str] = None,
    ) -> None:
        """Construct and send notifications for review lifecycle events."""
        enable_tg = getattr(settings, "enable_telegram_notifications", False)
        enable_wa = getattr(settings, "enable_whatsapp_notifications", False)

        if not (enable_tg or enable_wa):
            return

        # Clean narrative to avoid markdown issues in Telegram
        verdict = ""
        if narrative:
            # Take the first 3 lines or first 150 chars as preview
            lines = narrative.strip().split("\n")
            preview_lines = [line for line in lines if line.strip() and not line.startswith("#")]
            verdict = "\n".join(preview_lines[:3])
            if len(verdict) > 180:
                verdict = verdict[:180] + "..."

        status_emoji = {
            "completed": "✅",
            "approved": "🟢",
            "rejected": "🔴",
            "failed": "❌",
            "awaiting_approval": "🧠",
        }.get(status, "📝")

        # ── Telegram Content ──
        tg_text = (
            f"{status_emoji} *SYNAPSE Review {status.replace('_', ' ').title()}*\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"📝 *Title:* {title}\n"
        )
        if summary:
            tg_text += (
                f"📊 *Score:* {summary.overall_score}/10 | ⚠️ *Risk:* {summary.risk_level.upper()}\n"
                f"🐛 *Issues:* {summary.total_issues} ({summary.critical_issues} crit, {summary.security_vulnerabilities} sec)\n"
                f"🔧 *Fixes Available:* {summary.fixes_available}\n"
            )
        if verdict:
            tg_text += f"\n💬 *Hermes Verdict:*\n_{verdict}_\n"

        tg_text += (
            f"\n🔗 [View Full Report](http://localhost:5173/review/{session_id})\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"— Hermes, SYNAPSE Orchestrator"
        )

        # ── WhatsApp Content ──
        wa_text = (
            f"{status_emoji} *SYNAPSE Review {status.replace('_', ' ').title()}*\n"
            f"Title: {title}\n"
        )
        if summary:
            wa_text += (
                f"Score: {summary.overall_score}/10 | Risk: {summary.risk_level.upper()}\n"
                f"Issues: {summary.total_issues} ({summary.critical_issues} critical, {summary.security_vulnerabilities} security)\n"
                f"Fixes Available: {summary.fixes_available}\n"
            )
        if verdict:
            wa_text += f"\nVerdict: {verdict}\n"

        wa_text += f"\nLink: http://localhost:5173/review/{session_id}"

        # Dispatch
        if enable_tg:
            await self.send_telegram_message(tg_text)
        if enable_wa:
            await self.send_whatsapp_message(wa_text)


# Global singleton instance
notifier = NotificationService()
