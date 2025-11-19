import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import base64url from "base64url";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("google_token")?.value;
  if (!token)
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URL
  );
  oauth2Client.setCredentials({ access_token: token });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const res = await gmail.users.messages.list({ userId: "me", maxResults: 50 });
  const messages = res.data.messages || [];

  const mails = await Promise.all(
    messages.map(async (m) => {
      const email = await gmail.users.messages.get({ userId: "me", id: m.id! });
      const headers = email.data.payload?.headers || [];
      const subject = headers.find((h) => h.name === "Subject")?.value || "";
      const from = headers.find((h) => h.name === "From")?.value || "";

      let body = "";
      if (email.data.payload?.parts?.length) {
        const part = email.data.payload.parts.find(
          (p) => p.mimeType === "text/plain"
        );
        if (part?.body?.data) body = base64url.decode(part.body.data);
      } else if (email.data.payload?.body?.data) {
        body = base64url.decode(email.data.payload.body.data);
      }

      return { from, subject, body };
    })
  );
  console.log("Total mails fetched:", mails);
  const filteredEmails = mails.filter((email) =>
    /^VCB[A-Za-z0-9]/.test(email.subject?.trim() || "")
  );
  console.log("Filtered mails count:", filteredEmails.length);

  return NextResponse.json(filteredEmails);
  // return NextResponse.json(mails);
}
