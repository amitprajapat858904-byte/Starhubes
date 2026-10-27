export async function onRequestGet({ request, env }) {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return Response.json(
      { error: "Login required" },
      { status: 401 }
    );
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return Response.json(
      { error: "Auth configuration missing" },
      { status: 500 }
    );
  }

  const response = await fetch(
    `${env.SUPABASE_URL.replace(/\/+$/, "")}/auth/v1/user`,
    {
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    return Response.json(
      { error: "Invalid or expired session" },
      { status: 401 }
    );
  }

  const user = await response.json();

  if (!user.id) {
    return Response.json(
      { error: "Invalid user response" },
      { status: 401 }
    );
  }

  return Response.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email
    }
  });
}
