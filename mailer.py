"""Server-side SMTP email delivery for Untold Trails OTP verification."""

from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage


class EmailConfigError(RuntimeError):
    """Raised when required SMTP environment variables are missing."""


class EmailDeliveryError(RuntimeError):
    """Raised when sending an email through the configured SMTP server fails."""


def get_smtp_settings() -> dict:
    host = os.getenv("SMTP_HOST", "").strip()
    port_raw = os.getenv("SMTP_PORT", "587").strip()
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").strip()
    sender = os.getenv("SMTP_FROM", "").strip() or user
    use_ssl = os.getenv("SMTP_USE_SSL", "").strip().lower() in ("1", "true", "yes")

    missing = []
    if not host:
        missing.append("SMTP_HOST")
    if not user:
        missing.append("SMTP_USER")
    if not password:
        missing.append("SMTP_PASSWORD")

    if missing:
        raise EmailConfigError(
            "Email delivery is not configured on the server. "
            f"Missing environment variable(s): {', '.join(missing)}. "
            "Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM in .env."
        )

    try:
        port = int(port_raw or "587")
    except ValueError:
        port = 587

    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "sender": sender,
        "use_ssl": use_ssl or port == 465,
    }


def send_otp_email(to_email: str, recipient_name: str, otp: str) -> None:
    """Send a 6-digit verification OTP to the user's registered email address."""
    cfg = get_smtp_settings()

    msg = EmailMessage()
    msg["Subject"] = "Untold Trails — Verify Your Email (6-Digit OTP)"
    msg["From"] = cfg["sender"]
    msg["To"] = to_email

    plain_body = (
        f"Hello {recipient_name},\n\n"
        f"Your Untold Trails email verification code is: {otp}\n\n"
        "This code will expire in 5 minutes.\n"
        "If you did not request this account, please ignore this email.\n\n"
        "— Untold Trails (The Path Planner)"
    )
    html_body = f"""
    <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #FAF8F5; border-radius: 16px; border: 1px solid #E5E0D7;">
      <div style="font-weight: 700; font-size: 20px; color: #164A37; margin-bottom: 8px;">Untold Trails</div>
      <p style="color: #18181B; font-size: 14px; line-height: 1.6;">Hello {recipient_name},</p>
      <p style="color: #64625D; font-size: 14px; line-height: 1.6;">Use the 6-digit verification code below to activate your account:</p>
      <div style="margin: 20px 0; padding: 16px; background: #FFFFFF; border: 1px solid #E5E0D7; border-radius: 12px; text-align: center; font-size: 28px; font-weight: 700; letter-spacing: 8px; color: #164A37;">
        {otp}
      </div>
      <p style="color: #64625D; font-size: 12px;">This code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>
    </div>
    """

    msg.set_content(plain_body)
    msg.add_alternative(html_body, subtype="html")

    try:
        if cfg["use_ssl"]:
            with smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=15) as server:
                server.login(cfg["user"], cfg["password"])
                server.send_message(msg)
        else:
            with smtplib.SMTP(cfg["host"], cfg["port"], timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(cfg["user"], cfg["password"])
                server.send_message(msg)
    except EmailConfigError:
        raise
    except Exception as exc:
        raise EmailDeliveryError(f"Could not send verification email: {exc}") from exc
