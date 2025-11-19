import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code)
    return NextResponse.json({ error: "Code missing" }, { status: 400 });

  const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URL
  );

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // const origin = new URL(req.url).origin;
  // const redirectUrl = `${origin}/`;
  // const res = NextResponse.redirect(redirectUrl);
  const redirectUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const res = NextResponse.redirect(redirectUrl);
  res.cookies.set("google_token", tokens.access_token!, {
    httpOnly: true,
    maxAge: 24 * 60 * 60,
  });

  return res;
}
