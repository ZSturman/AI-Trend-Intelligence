import { NextResponse } from "next/server";

export function redirectWithStatus(requestUrl: string, status: string, detail?: string) {
  const url = new URL("/", requestUrl);
  url.searchParams.set("status", status);
  if (detail) {
    url.searchParams.set("detail", detail);
  }
  return NextResponse.redirect(url, { status: 303 });
}
