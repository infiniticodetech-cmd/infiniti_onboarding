export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return Response.json(
        { error: "The onboarding API is not connected yet. The frontend is deployed, but the backend must be deployed and connected before sign-in, invitations, or document uploads can work." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    return env.ASSETS.fetch(request);
  }
};
