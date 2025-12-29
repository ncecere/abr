import { NextResponse } from "next/server";

export function success<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function problem(
  status: number,
  title: string,
  detail?: string,
  extras?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      type: "about:blank",
      title,
      detail,
      ...extras,
    },
    { status },
  );
}
