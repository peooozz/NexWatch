import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const accountSid = (
      body.account_sid ||
      process.env.TWILIO_ACCOUNT_SID ||
      process.env.NEXT_PUBLIC_TWILIO_ACCOUNT_SID ||
      ""
    ).trim();

    const authToken = (
      body.auth_token ||
      process.env.TWILIO_AUTH_TOKEN ||
      process.env.NEXT_PUBLIC_TWILIO_AUTH_TOKEN ||
      ""
    ).trim();

    const fromNumber = (
      body.from_phone ||
      process.env.TWILIO_WHATSAPP_FROM ||
      "whatsapp:+17372508034"
    ).trim();

    const rawTo = (
      body.recipient_phone ||
      process.env.TWILIO_WHATSAPP_TO ||
      "+919322166721"
    ).trim();

    const formattedTo = rawTo.startsWith("whatsapp:")
      ? rawTo
      : `whatsapp:${rawTo.startsWith("+") ? rawTo : "+" + rawTo}`;

    const camName = body.camera_name || "Dharampeth Traffic Circle";
    const camId = body.camera_id || "CAM-003";
    const eventType = (body.event_type || "ACCIDENT / COLLISION")
      .replace(/_/g, " ")
      .toUpperCase();
    const severity = (body.severity || "CRITICAL").toUpperCase();
    const conf = Math.round((Number(body.confidence) || 0.98) * 100);
    const vehicleClass =
      body.vehicle_details?.objectClass || body.vehicle_class || "Auto Rickshaw";
    const plate =
      body.vehicle_details?.licensePlate || body.license_plate || "MH 31 TC 3341";
    const trackId = body.track_id || "TRK-301";
    const timeStr = new Date().toLocaleTimeString("en-IN", { hour12: false });

    let header = "🚨 *NEXWATCH CRITICAL ACCIDENT SOS* 🚨";
    let action = "🚨 DISPATCH AMBULANCE / EMS & TRAFFIC POLICE IMMEDIATELY";

    if (eventType.includes("CROWD") || eventType.includes("DENSITY")) {
      header = "👥 *NEXWATCH OVERCROWDING SURGE ALERT* 👥";
      action = "👥 DISPATCH RAPID ACTION FORCE (RAF) / CROWD CONTROL";
    } else if (eventType.includes("WRONG")) {
      header = "⛔ *NEXWATCH CONTRAFLOW / WRONG-WAY ALERT* ⛔";
      action = "⛔ INTERCEPT CONTRAFLOW VEHICLE / DIVERT TRAFFIC";
    }

    const messageText = `${header}
━━━━━━━━━━━━━━━━━━━━━
📍 *CCTV Area:* ${camName} (${camId})
⚠️ *Incident:* ${eventType}
🔴 *Severity:* ${severity} (${conf}% AI Conf)
🚗 *Target Vehicle:* ${vehicleClass} (${trackId})
🔢 *License Plate:* *${plate}*
⏱️ *Detection Time:* ${timeStr} IST
⚡ *Action Mandate:* ${action}
━━━━━━━━━━━━━━━━━━━━━
🔗 *Live CCTV Feeds:* https://cityeye-frontend.onrender.com/dashboard
📡 *NexWatch Command Center | Twilio Emergency Dispatch*`;

    const whatsappWebLink = `https://api.whatsapp.com/send?phone=${rawTo.replace(/[^0-9]/g, "")}&text=${encodeURIComponent(messageText)}`;

    if (!accountSid || !authToken) {
      console.warn("Twilio Account SID or Auth Token missing.");
      return NextResponse.json({
        success: false,
        warning: "TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN missing. Please enter them or configure in Render Dashboard.",
        formatted_message: messageText,
        whatsapp_web_url: whatsappWebLink,
        recipient: formattedTo,
      });
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    // 1. Try sending direct Body message
    const params = new URLSearchParams();
    params.append("From", fromNumber);
    params.append("To", formattedTo);
    params.append("Body", messageText);

    let twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    let twilioData = await twilioRes.json();

    // 2. If Twilio requires ContentSid (error code 21654 or 63016), retry with fallback template
    if (!twilioRes.ok && (twilioData.code === 21654 || twilioData.code === 63016 || twilioData.message?.includes("ContentSid"))) {
      console.log("Retrying with Twilio Sandbox template fallback...");
      
      const contentSid =
        process.env.TWILIO_CONTENT_SID ||
        "HXb5b62575e6e4ff6129ad7c8efe1f983e";

      const templateParams = new URLSearchParams();
      templateParams.append("From", fromNumber);
      templateParams.append("To", formattedTo);
      templateParams.append("ContentSid", contentSid);
      templateParams.append(
        "ContentVariables",
        JSON.stringify({
          "1": `${camName} (${eventType})`,
          "2": `${timeStr} IST - Plate: ${plate}`,
        })
      );

      twilioRes = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: templateParams.toString(),
      });

      twilioData = await twilioRes.json();
    }

    if (!twilioRes.ok) {
      console.error("Twilio API Error:", twilioData);
      return NextResponse.json(
        {
          success: false,
          twilio_error: twilioData,
          error_message: twilioData.message || "Twilio delivery error",
          recipient: formattedTo,
          formatted_message: messageText,
          whatsapp_web_url: whatsappWebLink,
        },
        { status: 200 } // Return 200 with error details so UI handles gracefully
      );
    }

    return NextResponse.json({
      success: true,
      sid: twilioData.sid,
      status: twilioData.status,
      recipient: formattedTo,
      formatted_message: messageText,
      whatsapp_web_url: whatsappWebLink,
    });
  } catch (error: any) {
    console.error("WhatsApp Dispatch Handler Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
