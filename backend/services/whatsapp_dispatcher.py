"""
NexWatch - WhatsApp Real-Time Emergency Alert Dispatcher
========================================================
Transmits instant WhatsApp SOS dispatch messages to Police Control Room (PCR),
Traffic Authorities, and Emergency Medical Services (EMS) for critical incidents:
  - 💥 Accident & Collisions (100% Impact Vectors)
  - 👥 Overcrowding & Stampede Surges (> 85 pax/100m²)
  - ⛔ Wrong-Way / Contraflow Incursions
  - 🛑 Hazardous Stopped Vehicles
"""

import os
import urllib.parse
import logging
from datetime import datetime
from typing import Dict, Any, Optional

logger = logging.getLogger("NexWatchWhatsApp")

DEFAULT_EMERGENCY_NUMBER = os.getenv("WHATSAPP_EMERGENCY_PHONE", "+919876543210")

def format_whatsapp_alert_message(alert: Dict[str, Any]) -> str:
    cam_name = alert.get("camera_name") or alert.get("cctv_area_name") or "Wardha Road Surveillance"
    cam_id = alert.get("camera_id") or "CAM-001"
    event_type = alert.get("event_type", "INCIDENT_ALERT").replace("_", " ").upper()
    severity = alert.get("severity", "CRITICAL").upper()
    confidence = float(alert.get("confidence", 0.98)) * 100
    
    vehicle_details = alert.get("vehicle_details") or {}
    v_class = alert.get("vehicle_class") or vehicle_details.get("objectClass") or "Auto Rickshaw"
    plate = alert.get("license_plate") or vehicle_details.get("licensePlate") or "MH 31 TA 1204"
    track_id = alert.get("track_id") or "TRK-001"
    
    timestamp = alert.get("detected_at") or datetime.now().strftime("%d %b %Y, %H:%M:%S IST")
    
    # Custom Emergency Directives
    if "ACCIDENT" in event_type or "COLLISION" in event_type:
        action = "🚨 DISPATCH AMBULANCE / EMS & TRAFFIC POLICE IMMEDIATELY"
        header = "🚨 *NEXWATCH CRITICAL ACCIDENT SOS* 🚨"
    elif "CROWD" in event_type or "OVERCROWD" in event_type:
        action = "👥 DISPATCH RAPID ACTION FORCE (RAF) / CROWD CONTROL"
        header = "👥 *NEXWATCH MASS OVERCROWDING SURGE ALERT* 👥"
    elif "WRONG_WAY" in event_type or "CONTRAFLOW" in event_type:
        action = "⛔ INTERCEPT CONTRAFLOW VEHICLE / DIVERT TRAFFIC"
        header = "⛔ *NEXWATCH CONTRAFLOW / WRONG-WAY ALERT* ⛔"
    else:
        action = "⚠️ DISPATCH LOCAL PCR PATROL UNIT FOR INTERVENTION"
        header = "⚠️ *NEXWATCH CRITICAL TRAFFIC INCIDENT* ⚠️"

    msg = (
        f"{header}\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"📍 *CCTV Area:* {cam_name} ({cam_id})\n"
        f"⚠️ *Violation:* {event_type}\n"
        f"🔴 *Severity Level:* {severity} ({confidence:.0f}% AI Confidence)\n"
        f"🚗 *Target Vehicle:* {v_class} (`{track_id}`)\n"
        f"🔢 *License Plate:* *{plate}*\n"
        f"⏱️ *Detection Time:* {timestamp}\n"
        f"⚡ *Action Mandate:* {action}\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"🔗 *Live CCTV Feeds:* https://cityeye-frontend.onrender.com/dashboard\n"
        f"📡 *CityEye Command Center | Auto-Telemetry Dispatch*"
    )
    return msg

def generate_whatsapp_click_url(alert: Dict[str, Any], phone: Optional[str] = None) -> str:
    target_phone = phone or DEFAULT_EMERGENCY_NUMBER
    # Clean phone number (remove spaces, +, -)
    clean_phone = target_phone.replace("+", "").replace(" ", "").replace("-", "")
    message_text = format_whatsapp_alert_message(alert)
    encoded_text = urllib.parse.quote(message_text)
    return f"https://api.whatsapp.com/send?phone={clean_phone}&text={encoded_text}"

def dispatch_whatsapp_notification(alert: Dict[str, Any], phone: Optional[str] = None) -> Dict[str, Any]:
    """
    Sends WhatsApp notification via Twilio / Meta Cloud API (if configured)
    and returns direct click-to-chat URL + dispatch confirmation.
    """
    target_phone = phone or DEFAULT_EMERGENCY_NUMBER
    formatted_msg = format_whatsapp_alert_message(alert)
    click_url = generate_whatsapp_click_url(alert, target_phone)
    
    twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
    twilio_auth = os.getenv("TWILIO_AUTH_TOKEN")
    twilio_from = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")
    
    dispatched_via_api = False
    api_error = None
    
    if twilio_sid and twilio_auth:
        try:
            import requests
            url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Messages.json"
            to_number = f"whatsapp:{target_phone}" if not target_phone.startswith("whatsapp:") else target_phone
            resp = requests.post(
                url,
                data={
                    "From": twilio_from,
                    "To": to_number,
                    "Body": formatted_msg,
                },
                auth=(twilio_sid, twilio_auth),
                timeout=5,
            )
            if resp.status_code in [200, 201]:
                dispatched_via_api = True
                logger.info(f"WhatsApp API dispatch successful to {target_phone}")
            else:
                api_error = resp.text
                logger.warning(f"Twilio WhatsApp dispatch failed ({resp.status_code}): {resp.text}")
        except Exception as e:
            api_error = str(e)
            logger.error(f"Error during Twilio WhatsApp dispatch: {e}")

    return {
        "status": "success",
        "dispatched_at": datetime.now().isoformat(),
        "recipient_phone": target_phone,
        "dispatched_via_api": dispatched_via_api,
        "api_error": api_error,
        "whatsapp_url": click_url,
        "formatted_message": formatted_msg,
    }
