import { NextResponse } from "next/server";

/**
 * Local mock backend when NEXT_PUBLIC_USE_MOCK=1.
 * Canned responses matching Frontend/frontend.md §5 / §9 land in API integration.
 */
export async function GET() {
  return NextResponse.json({
    status: "mock_ready",
    message: "Mock routes will be implemented in the API integration step.",
  });
}

export async function POST() {
  return NextResponse.json({
    status: "mock_ready",
    message: "Mock routes will be implemented in the API integration step.",
  });
}

export async function PATCH() {
  return NextResponse.json({
    status: "mock_ready",
    message: "Mock routes will be implemented in the API integration step.",
  });
}
