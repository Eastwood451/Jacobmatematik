import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body:unknown, status=200) => new Response(JSON.stringify(body), { status, headers:{ ...cors, "Content-Type":"application/json" } });
const emailForUsername = (username:string) => `${username.trim().toLowerCase()}@users.jacobmatematik.invalid`;

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
    if (!user) return json({ error:"Ikke logget ind." }, 401);
    const { data:teacher } = await admin.from("profiles").select("id,role").eq("id", user.id).single();
    if (teacher?.role !== "teacher") return json({ error:"Kun læreren kan ændre elevkonti." }, 403);

    const body = await request.json();
    const action = String(body.action || "");
    if (action === "create") {
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");
      const name = String(body.name || "").trim();
      if (!username || !password || !name) return json({ error:"Navn, brugernavn og adgangskode mangler." }, 400);
      const created = await admin.auth.admin.createUser({ email:emailForUsername(username), password, email_confirm:true });
      if (created.error) return json({ error:created.error.message }, 400);
      const inserted = await admin.from("profiles").insert({ id:created.data.user.id, teacher_id:user.id, role:"student", username, name });
      if (inserted.error) {
        await admin.auth.admin.deleteUser(created.data.user.id);
        return json({ error:inserted.error.message }, 400);
      }
      return json({ id:created.data.user.id });
    }

    const studentId = String(body.studentId || "");
    const { data:student } = await admin.from("profiles").select("id,teacher_id").eq("id", studentId).single();
    if (!student || student.teacher_id !== user.id) return json({ error:"Eleven blev ikke fundet." }, 404);
    if (action === "password") {
      const updated = await admin.auth.admin.updateUserById(studentId, { password:String(body.password || "") });
      if (updated.error) return json({ error:updated.error.message }, 400);
      return json({ ok:true });
    }
    if (action === "username") {
      const username = String(body.username || "").trim().toLowerCase();
      const updated = await admin.auth.admin.updateUserById(studentId, { email:emailForUsername(username), email_confirm:true });
      if (updated.error) return json({ error:updated.error.message }, 400);
      const profile = await admin.from("profiles").update({ username }).eq("id", studentId);
      if (profile.error) return json({ error:profile.error.message }, 400);
      return json({ ok:true });
    }
    if (action === "delete") {
      const removed = await admin.auth.admin.deleteUser(studentId);
      if (removed.error) return json({ error:removed.error.message }, 400);
      return json({ ok:true });
    }
    return json({ error:"Ukendt handling." }, 400);
  } catch (error) {
    return json({ error:error instanceof Error ? error.message : "Ukendt fejl." }, 500);
  }
});
