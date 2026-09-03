import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error("Missing Supabase Edge Function environment variables.");
}

const adminClient = createClient(supabaseUrl, serviceRoleKey);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function loginEmail(loginName: string) {
  const normalized = loginName.toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return `${normalized}@stgeorges.local`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "POST required" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ success: false, error: "Missing authorization" }, 401);
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user: currentUser },
      error: currentUserError,
    } = await userClient.auth.getUser(token);

    if (currentUserError || !currentUser) {
      return json({ success: false, error: "Invalid or expired administrator session." }, 401);
    }

    const { data: adminProfile, error: adminProfileError } = await adminClient
      .from("profiles")
      .select("id, role, active")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (
      adminProfileError ||
      !adminProfile ||
      adminProfile.role !== "admin" ||
      adminProfile.active !== true
    ) {
      return json({ success: false, error: "Administrator access required." }, 403);
    }

    const body = await req.json();

    const userId = clean(body.user_id);
    const loginName = clean(body.login_name);
    const email = clean(body.email);
    const fullName = clean(body.full_name);
    const phone = clean(body.phone);
    const role = clean(body.role).toLowerCase();
    const section = clean(body.section);
    const grade = clean(body.grade);
    const stream = clean(body.stream);
    const password = typeof body.password === "string" ? body.password : "";
    const active = body.active === true;

    if (!userId) return json({ success: false, error: "user_id is required." }, 400);
    if (!loginName) return json({ success: false, error: "Login name is required." }, 400);
    if (!fullName) return json({ success: false, error: "Full name is required." }, 400);

    if (!["admin", "teacher"].includes(role)) {
      return json({ success: false, error: "Role must be admin or teacher." }, 400);
    }

    if (role === "teacher") {
      if (!section) return json({ success: false, error: "Section is required for a Class Teacher." }, 400);
      if (!grade) return json({ success: false, error: "Class / Grade is required for a Class Teacher." }, 400);
      if (section !== "ECDE" && !stream) {
        return json({ success: false, error: "Stream is required for a Class Teacher." }, 400);
      }
    }

    if (password && password.length < 8) {
      return json({ success: false, error: "Password must be at least 8 characters." }, 400);
    }

    // Do not allow two staff profiles to use the same login name.
    const { data: duplicate, error: duplicateError } = await adminClient
      .from("profiles")
      .select("id")
      .ilike("login_name", loginName)
      .neq("id", userId)
      .limit(1)
      .maybeSingle();

    if (duplicateError) {
      return json({ success: false, error: `Could not check login name: ${duplicateError.message}` }, 400);
    }

    if (duplicate) {
      return json({ success: false, error: `Login name "${loginName}" is already in use.` }, 409);
    }

    // IMPORTANT:
    // The frontend login accepts "8JK" and converts it to 8jk@stgeorges.local.
    // Therefore Auth must always use the canonical login-name email.
    const canonicalAuthEmail = loginEmail(loginName);

    const authUpdates: Record<string, unknown> = {
      email: canonicalAuthEmail,
      user_metadata: {
        login_name: loginName,
        full_name: fullName,
        role,
      },
    };

    if (password) {
      authUpdates.password = password;
    }

    const { data: authData, error: authError } =
      await adminClient.auth.admin.updateUserById(userId, authUpdates);

    if (authError) {
      return json({ success: false, error: `Auth update failed: ${authError.message}` }, 400);
    }

    const profilePayload = {
      login_name: loginName,
      // Keep the optional contact email in profiles only.
      email: email || null,
      full_name: fullName,
      phone: phone || null,
      role,
      section: role === "teacher" ? section : null,
      grade: role === "teacher" ? grade : null,
      stream: role === "teacher" && section !== "ECDE" ? stream : null,
      active,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedProfile, error: profileUpdateError } = await adminClient
      .from("profiles")
      .update(profilePayload)
      .eq("id", userId)
      .select("*")
      .single();

    if (profileUpdateError) {
      return json({
        success: false,
        error: `Auth was updated but the staff profile could not be updated: ${profileUpdateError.message}`,
      }, 400);
    }

    return json({
      success: true,
      profile: updatedProfile,
      auth_email: authData.user?.email || canonicalAuthEmail,
    });
  } catch (err) {
    return json({
      success: false,
      error: err instanceof Error ? err.message : "Unexpected server error.",
    }, 500);
  }
});
