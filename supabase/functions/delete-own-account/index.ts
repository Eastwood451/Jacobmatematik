import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body:unknown, status=200) => new Response(JSON.stringify(body), { status, headers:{ ...cors, "Content-Type":"application/json" } });
const normalizeUsername = (value:unknown) => String(value || "").trim().normalize("NFC").toLowerCase();

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers:cors });
  try {
    const authorization = request.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const caller = createClient(url, anonKey, { global:{ headers:{ Authorization:authorization } } });
    const admin = createClient(url, serviceKey);
    const { data:{ user } } = await caller.auth.getUser();
    if (!user) return json({ error:"not_logged_in" }, 401);

    let body:Record<string, unknown> = {};
    try { body = await request.json(); } catch { body = {}; }
    // The caller is only the JWT user. A user id in the body is ignored.
    const { data:profile, error:profileError } = await admin.from("profiles").select("id,role,username,teacher_id").eq("id", user.id).maybeSingle();
    if (profileError) return json({ error:"delete_failed" }, 500);
    if (!profile) return json({ error:"profile_missing" }, 409);
    if (normalizeUsername(body.confirmUsername) !== normalizeUsername(profile.username)) return json({ error:"username_mismatch" }, 400);

    if (profile.role === "teacher") {
      const { data:pupils, error:pupilError } = await admin.from("profiles").select("id").eq("teacher_id", user.id).eq("role", "student");
      if (pupilError) return json({ error:"delete_failed" }, 500);
      if (pupils?.length) return json({ error:"teacher_has_students" }, 409);
    } else if (profile.role === "student" && profile.teacher_id) {
      const { data:school, error:schoolError } = await admin.from("school_state").select("data").eq("teacher_id", profile.teacher_id).maybeSingle();
      if (schoolError) return json({ error:"delete_failed" }, 500);
      if (school?.data && typeof school.data === "object" && !Array.isArray(school.data)) {
        const data = school.data as { users?:unknown[]; classes?:unknown[] };
        const previous = data;
        const users = Array.isArray(data.users) ? data.users.filter(item => !item || typeof item !== "object" || (item as { id?:unknown }).id !== user.id) : [];
        const updated = await admin.from("school_state").update({ data:{ ...data, users }, updated_at:new Date().toISOString() }).eq("teacher_id", profile.teacher_id);
        if (updated.error) return json({ error:"delete_failed" }, 500);
        const removed = await removeAuthUser(admin, authorization, user.id);
        if (removed.error) {
          await admin.from("school_state").update({ data:previous, updated_at:new Date().toISOString() }).eq("teacher_id", profile.teacher_id);
          return json({ error:"delete_failed" }, 500);
        }
        return json({ ok:true });
      }
    }

    const removed = await removeAuthUser(admin, authorization, user.id);
    if (removed.error) return json({ error:"delete_failed" }, 500);
    return json({ ok:true });
  } catch {
    return json({ error:"delete_failed" }, 500);
  }
});

async function removeAuthUser(admin:{ auth:{ admin:{ signOut:(jwt:string, scope?:string) => Promise<unknown>; deleteUser:(id:string) => Promise<{ error?:unknown }> } } }, authorization:string, userId:string) {
  const jwt = authorization.replace(/^Bearer\s+/i, "");
  if (jwt) {
    try { await admin.auth.admin.signOut(jwt, "global"); } catch { /* The user row is still deleted below. */ }
  }
  return admin.auth.admin.deleteUser(userId);
}
