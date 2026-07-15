import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { Resend } from "resend";
import { get, del } from "@vercel/blob";

export const runtime = "nodejs";
export const maxDuration = 60;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const resend = new Resend(process.env.RESEND_API_KEY!);

const RECIPIENT_EMAIL = process.env.NOTIFICATION_EMAIL ?? "jboarnerges@advancedteamelite.com";

// Mismo modelo que ya usas y funciona en tu chatbot (app/api/chat/route.ts)
const GEMINI_MODEL = "gemini-3.1-flash-lite";

const SUMMARY_PROMPT = `You are an assistant for Advanced Roofing Team Construction, a roofing company in Illinois.

You will receive an audio recording of a phone call between a customer and either a live agent or an AI phone assistant.

TASK:
1. Listen to the audio and transcribe it internally (do not output the raw transcript).
2. Produce a structured lead summary in EXACTLY the following format, filling in the fields based on what was said in the call. If a piece of information was not mentioned, write "Not provided" (or "Unknown" where appropriate for yes/no fields).

FORMAT (follow exactly, including line breaks and labels):

Lead Summary – [Short 3-6 word description of the call, e.g. "Gutter + Leak Estimate"]
Full name: [customer full name, or "Not provided"]
Callback number: [phone number, or "Not provided"]
Email: [email, or "Not provided"]
Address: [address, or "Not provided"]
Lead type: [e.g. Leak Estimate, Full Replacement, Repair, Inspection, Emergency, etc.]
Insurance claim: [Yes / No / Unknown]
Priority: [Emergency / High / Normal / Low — based on urgency expressed in the call]
Notes:
[2-5 short factual sentences, one per line, summarizing what happened in the call — what the customer asked, what was reported, what was clarified, and any follow-up needed.]

RULES:
- Only output the structured summary above. No preamble, no markdown formatting, no code blocks, no extra commentary.
- Keep "Notes" concise and factual — do not invent details that weren't in the call.
- If the audio is unclear, mostly silence, or not a roofing-related call, say so plainly in the Notes and fill the other fields with "Not provided".`;

function guessMimeType(filename: string, provided: string | null): string {
  if (provided && provided.startsWith("audio/")) return provided;
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    aac: "audio/aac",
    ogg: "audio/ogg",
    flac: "audio/flac",
    webm: "audio/webm",
  };
  return map[ext ?? ""] ?? "audio/mpeg";
}

function summaryEmailHtml(summaryText: string, originalFilename: string): string {
  const lines = summaryText.split("\n").map((rawLine) => {
    const escaped = rawLine
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    if (escaped.startsWith("Lead Summary")) {
      return `<h2 style="color:#1e3a5f;font-size:18px;margin:0 0 14px;">${escaped}</h2>`;
    }

    const match = escaped.match(/^([A-Za-z ]+):\s*(.*)$/);
    if (match) {
      return `<div style="margin:4px 0;font-size:14px;"><strong style="color:#1e3a5f;">${match[1]}:</strong> <span style="color:#374151;">${match[2]}</span></div>`;
    }

    if (escaped.trim() === "") {
      return `<div style="height:8px;"></div>`;
    }

    return `<div style="margin:2px 0;font-size:14px;color:#374151;">${escaped}</div>`;
  });

  return `
  <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto;">
    <div style="background:#1e3a5f;padding:20px 28px;border-radius:8px 8px 0 0;">
      <h2 style="color:#fff;margin:0;font-size:18px;">📞 Call Summary</h2>
      <p style="color:#93c5fd;margin:4px 0 0;font-size:12px;">Advanced Roofing Team · Call Recording Summarizer</p>
    </div>
    <div style="background:#fff;padding:28px;border:1px solid #e5e7eb;border-top:none;">
      ${lines.join("\n")}
    </div>
    <div style="background:#f9fafb;padding:14px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;font-size:11px;color:#9ca3af;text-align:center;">
      Source file: ${originalFilename}
    </div>
  </div>`;
}

export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    const body = await req.json();
    const { audioPath, filename, contentType } = body as {
      audioPath?: string;
      filename?: string;
      contentType?: string | null;
    };

    console.log("[summarize-call] incoming request", { audioPath, filename, contentType });

    if (!audioPath || !filename) {
      console.error("[summarize-call] missing audioPath or filename");
      return NextResponse.json({ error: "Missing audioPath or filename" }, { status: 400 });
    }

    // Read the PRIVATE blob back server-side. This requires
    // BLOB_READ_WRITE_TOKEN and is never exposed via a public URL.
    console.log("[summarize-call] reading private blob:", audioPath);
    const result = await get(audioPath, { access: "private" });

    if (!result || result.statusCode !== 200 || !result.stream) {
      console.error("[summarize-call] blob not found:", audioPath);
      return NextResponse.json({ error: "Audio file not found in storage" }, { status: 404 });
    }

    const arrayBuffer = await new Response(result.stream).arrayBuffer();
    console.log("[summarize-call] downloaded bytes:", arrayBuffer.byteLength);

    // We only needed the blob temporarily to get the bytes past Vercel's
    // request-size limit. Delete it now so nothing lingers in storage.
    try {
      await del(audioPath);
      console.log("[summarize-call] deleted blob:", audioPath);
    } catch (deleteError) {
      console.error("[summarize-call] failed to delete blob (non-fatal):", deleteError);
    }

    const base64Audio = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = guessMimeType(filename, contentType ?? result.blob.contentType);
    console.log("[summarize-call] resolved mimeType:", mimeType);

    console.log("[summarize-call] calling Gemini model:", GEMINI_MODEL);
    const result2 = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: SUMMARY_PROMPT },
            {
              inlineData: {
                mimeType,
                data: base64Audio,
              },
            },
          ],
        },
      ],
    });

    const summaryText = result2.text?.trim() ?? "";
    console.log("[summarize-call] Gemini responded, length:", summaryText.length);

    if (!summaryText) {
      console.error("[summarize-call] empty summary from Gemini");
      return NextResponse.json({ error: "Gemini returned an empty summary" }, { status: 500 });
    }

    console.log("[summarize-call] sending email via Resend to:", RECIPIENT_EMAIL);
    const emailResult = await resend.emails.send({
      from: "Advanced Roofing Calls <info@contact.advancedteamelite.com>",
      to: RECIPIENT_EMAIL,
      subject: `Call Summary — ${filename}`,
      html: summaryEmailHtml(summaryText, filename),
    });
    console.log("[summarize-call] Resend result:", emailResult);

    console.log("[summarize-call] done in ms:", Date.now() - startedAt);
    return NextResponse.json({ success: true, summary: summaryText });
  } catch (error) {
    console.error("[summarize-call] unhandled error:", error);
    return NextResponse.json(
        {
          error: "Internal Server Error",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
    );
  }
}