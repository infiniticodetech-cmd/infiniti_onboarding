export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Proxy API requests to your live backend service
    if (url.pathname.startsWith("/api/")) {
      const backendOrigin = env.BACKEND_URL;
      if (!backendOrigin) {
        return Response.json(
          { error: "BACKEND_URL is not configured yet in wrangler.jsonc or environment variables." },
          { status: 503, headers: { "Cache-Control": "no-store" } }
        );
      }

      const targetUrl = new URL(url.pathname + url.search, backendOrigin);
      const headers = new Headers(request.headers);
      headers.set("Host", new URL(backendOrigin).host);
      headers.set("X-Forwarded-Host", url.host);
      headers.set("X-Forwarded-Proto", "https");

      const backendRequest = new Request(targetUrl, {
        method: request.method,
        headers: headers,
        body: ["GET", "HEAD"].includes(request.method) ? null : request.body,
        redirect: "manual"
      });

      return fetch(backendRequest);
    }

    // Serve static frontend assets (Vite React application)
    return env.ASSETS.fetch(request);
  }
};
