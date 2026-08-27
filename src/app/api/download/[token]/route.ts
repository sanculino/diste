import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { verifyDownloadToken } from "@/lib/license-api";
import { privateInstallersDir } from "@/lib/server-config";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  try {
    const meta = await verifyDownloadToken(token);
    const filePath = path.join(privateInstallersDir, meta.filename);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Installer not available" }, { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const stream = fs.createReadStream(filePath);
    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${meta.filename}"`,
        "Content-Length": String(stat.size),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Download denied";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
