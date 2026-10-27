export async function onRequestPost({ request, env }) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  };

  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.DB) {
      return Response.json(
        { error: "Server configuration missing" },
        { status: 500, headers }
      );
    }

    const body = await request.json();
    const username = String(body.username || "").trim().toLowerCase();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      return Response.json(
        { error: "Username must be 3–24 characters: letters, numbers, underscore" },
        { status: 400, headers }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json(
        { error: "Enter a valid email address" },
        { status: 400, headers }
      );
    }

    if (password.length < 8 || password.length > 128) {
      return Response.json(
        { error: "Password must be 8–128 characters" },
        { status: 400, headers }
      );
    }

    const existing = await env.DB.prepare(
      "SELECT id FROM users WHERE username = ? COLLATE NOCASE"
    ).bind(username).first();

    if (existing) {
      return Response.json(
        { error: "Username is unavailable" },
        { status: 409, headers }
      );
    }

    const supabaseUrl = env.SUPABASE_URL.replace(/\/+$/, "");
    const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": env.SUPABASE_PUBLISHABLE_KEY
      },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: "Signup could not be completed. Check your details or try again." },
        { status: 400, headers }
      );
    }

    const user = result.user;
    if (!user?.id) {
      return Response.json(
        { error: "Signup response incomplete. Check your email and try signing in." },
        { status: 400, headers }
      );
    }

    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO users
       (id, username, password_salt, password_hash, role, created_at, supabase_user_id)
       VALUES (?, ?, '', '', 'student', ?, ?)`
    ).bind(id, username, Date.now(), user.id).run();

    return Response.json({
      ok: true,
      message: "Signup request received. Check your email if confirmation is required."
    }, { status: 201, headers });

  } catch {
    return Response.json(
      { error: "Unexpected server error. Please try again." },
      { status: 500, headers }
    );
  }
}
