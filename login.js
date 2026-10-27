

export async function onRequestPost({ request, env }) {
  const headers = { "Cache-Control": "no-store" };

  try {
    if (
      !env.DB ||
      !env.SUPABASE_URL ||
      !env.SUPABASE_PUBLISHABLE_KEY ||
      !env.SUPABASE_SECRET_KEY
    ) {
      return Response.json(
        { error: "Server configuration missing" },
        { status: 500, headers }
      );
    }

    const body = await request.json();
    const username = String(body.username || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");

    if (
      !/^[a-z0-9_]{3,24}$/.test(username) ||
      password.length < 1 ||
      password.length > 128
    ) {
      return Response.json(
        { error: "Invalid username or password" },
        { status: 400, headers }
      );
    }

    const row = await env.DB.prepare(
      `SELECT supabase_user_id
       FROM users
       WHERE username = ? COLLATE NOCASE`
    ).bind(username).first();

    if (!row?.supabase_user_id) {
      return Response.json(
        { error: "Invalid username or password" },
        { status: 401, headers }
      );
    }

    const baseUrl = env.SUPABASE_URL.replace(/\/+$/, "");

    const userResponse = await fetch(
      `${baseUrl}/auth/v1/admin/users/${encodeURIComponent(row.supabase_user_id)}`,
      {
        headers: {
          apikey: env.SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`
        }
      }
    );

    if (!userResponse.ok) {
      return Response.json(
        { error: "Could not verify account" },
        { status: 503, headers }
      );
    }

    const account = await userResponse.json();

    if (!account.email) {
      return Response.json(
        { error: "Invalid username or password" },
        { status: 401, headers }
      );
    }

    const authResponse = await fetch(
      `${baseUrl}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.SUPABASE_PUBLISHABLE_KEY
        },
        body: JSON.stringify({
          email: account.email,
          password
        })
      }
    );

    const session = await authResponse.json();

    if (!authResponse.ok || !session.access_token) {
      return Response.json(
        { error: "Invalid username or password" },
        { status: 401, headers }
      );
    }

    return Response.json({
      ok: true,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      user: {
        id: session.user.id,
        username
      }
    }, { headers });

  } catch {
    return Response.json(
      { error: "Unexpected server error" },
      { status: 500, headers }
    );
  }
}
