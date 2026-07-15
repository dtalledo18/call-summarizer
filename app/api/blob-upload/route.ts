import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
    const body = (await request.json()) as HandleUploadBody;

    try {
        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async () => {
                return {
                    allowedContentTypes: [
                        "audio/mpeg",
                        "audio/wav",
                        "audio/x-wav",
                        "audio/mp4",
                        "audio/x-m4a",
                        "audio/aac",
                        "audio/ogg",
                        "audio/flac",
                        "audio/webm",
                    ],
                    // Safety cap — adjust if you expect longer recordings
                    maximumSizeInBytes: 300 * 1024 * 1024, // 300MB
                    // Avoid "blob already exists" errors when re-uploading a file
                    // with the same name (e.g. testing the same recording twice).
                    addRandomSuffix: true,
                };
            },
            onUploadCompleted: async ({ blob }) => {
                console.log("[blob-upload] upload completed:", blob.url);
            },
        });

        return NextResponse.json(jsonResponse);
    } catch (error) {
        console.error("[blob-upload] error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Upload token error" },
            { status: 400 }
        );
    }
}