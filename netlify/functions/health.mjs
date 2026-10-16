export default function handler() {
  return Response.json({
    success: true,
    service: "gbm-web",
    timestamp: new Date().toISOString()
  }, { headers: { "cache-control": "no-store" } });
}

export const config = { path: "/api/health", method: "GET" };
