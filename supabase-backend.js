(() => {
  "use strict";

  const config = window.JACOBMATEMATIK_SUPABASE || {};
  const configured = Boolean(config.url && config.publishableKey && window.supabase?.createClient);
  const client = configured ? window.supabase.createClient(config.url, config.publishableKey) : null;
  const normalizeUsername = value => String(value || "").trim().normalize("NFC").toLowerCase();
  async function emailForUsername(value) {
    const username = normalizeUsername(value);
    // Keep existing ASCII logins unchanged. Unicode names use an ASCII-only
    // internal address; the original name stays in profiles and school_state.
    if (!/[æøå]/.test(username)) return `${username}@users.jacobmatematik.invalid`;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(username));
    const alias = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    return `${alias}@unicode.users.jacobmatematik.invalid`;
  }
  const withoutSecrets = user => {
    const { password, canManageRegistrations, ...safeUser } = user;
    return safeUser;
  };
  const throwIfError = ({ error }) => { if (error) throw error; };
  const RESULTS_PAGE_SIZE = 1000;

  async function fetchResultRows(after = null) {
    const rows = [];
    for (let from = 0; ; from += RESULTS_PAGE_SIZE) {
      let query = client
        .from("results")
        .select("id,student_id,data,created_at")
        .order("created_at", { ascending:true })
        .order("id", { ascending:true })
        .range(from, from + RESULTS_PAGE_SIZE - 1);
      if (after) query=query.gte("created_at",after);
      const response = await query;
      throwIfError(response);
      const page = response.data || [];
      rows.push(...page);
      if (page.length < RESULTS_PAGE_SIZE) return rows;
    }
  }

  async function signIn(username, password) {
    const response = await client.auth.signInWithPassword({ email:await emailForUsername(username), password });
    throwIfError(response);
    return loadDatabase();
  }

  async function signUp(username, password) {
    username = normalizeUsername(username);
    if (!/^[a-zæøå0-9._-]{1,40}$/.test(username)) throw new Error("Brug 1–40 tegn: a–z, æ, ø, å, tal, punktum, bindestreg eller understregning.");
    if (password.length < 6) throw new Error("Adgangskoden skal have mindst 6 tegn.");
    const enabled = await client.rpc("self_registration_enabled");
    if (enabled.error || enabled.data !== true) throw new Error("Oprettelse af brugere er ikke aktiveret endnu. Prøv igen senere.");
    const response = await client.auth.signUp({
      email:await emailForUsername(username), password,
      options:{ data:{ username, registration_source:"self" } },
    });
    if (response.error) {
      if (["user_already_exists", "email_exists"].includes(response.error.code)) throw new Error("Brugernavnet er allerede i brug. Vælg et andet.");
      if (response.error.status === 429) throw new Error("Der er for mange oprettelser lige nu. Vent lidt og prøv igen.");
      if (response.error.code === "weak_password") throw new Error("Vælg en stærkere adgangskode med mindst 6 tegn.");
      throw new Error("Brugeren kunne ikke oprettes. Prøv et andet brugernavn eller prøv igen senere.");
    }
    if (!response.data?.session) throw new Error("Kontoen afventer aktivering. Kontakt Jacob, før du prøver at oprette den igen.");
  }

  async function listSelfRegistered(search = "", offset = 0) {
    const response = await client.rpc("list_self_registered", { p_search:search, p_offset:offset });
    throwIfError(response);
    return response.data || [];
  }

  async function assignSelfRegistered(studentId, classId) {
    const response = await client.rpc("assign_self_registered", { target_student:studentId, target_class:classId });
    throwIfError(response);
  }

  async function signOut() {
    if (client) await client.auth.signOut();
  }

  async function loadDatabase() {
    const { data:{ user }, error:userError } = await client.auth.getUser();
    if (userError || !user) throw userError || new Error("Ingen aktiv session.");
    const profileResponse = await client.from("profiles").select("id,teacher_id,role,username,name").eq("id", user.id).single();
    throwIfError(profileResponse);
    const profile = profileResponse.data;
    const teacherId = profile.role === "teacher" ? profile.id : profile.teacher_id;
    const stateResponse = profile.role === "teacher"
      ? await client.from("school_state").select("data").eq("teacher_id", teacherId).single()
      : await client.rpc("get_my_student_state");
    throwIfError(stateResponse);
    const resultRows = await fetchResultRows();
    const school = (profile.role === "teacher" ? stateResponse.data?.data : stateResponse.data) || { classes:[], users:[] };
    const users = (school.users || []).map(item => ({ ...item, results:[] }));
    const current = users.find(item => item.id === profile.id);
    if (!current) users.push({ ...profile, classId:null, results:[] });
    const ownUser = users.find(item => item.id === profile.id);
    // Always use the server profile for authorization, never a school JSON flag.
    ownUser.role = profile.role;
    ownUser.canManageRegistrations = false;
    if (profile.role === "teacher") {
      const permission = await client.rpc("can_manage_self_registered");
      ownUser.canManageRegistrations = !permission.error && permission.data === true;
    }
    resultRows.forEach(row => {
      const student = users.find(item => item.id === row.student_id);
      if (student) student.results.push({ ...row.data, remoteId:row.id });
    });
    return {
      database:{ classes:school.classes || [], users },
      currentUserId:profile.id,
    };
  }

  async function loadSchoolState(teacherId) {
    const response = await client.from("school_state").select("data").eq("teacher_id", teacherId).single();
    throwIfError(response);
    return response.data?.data || { classes:[], users:[] };
  }

  async function saveSchoolState(database, teacherId) {
    const data = {
      classes:(database.classes || []).map(item => ({ id:item.id, name:item.name })),
      users:(database.users || []).map(withoutSecrets).map(({ results, ...user }) => user),
    };
    const response = await client.from("school_state").upsert({ teacher_id:teacherId, data, updated_at:new Date().toISOString() });
    throwIfError(response);
  }

  async function loadResults(after = null) {
    const rows = await fetchResultRows(after);
    return rows.map(row => ({ ...row.data, remoteId:row.id, studentId:row.student_id, createdAt:row.created_at }));
  }

  async function appendResult(studentId, result) {
    const { remoteId, ...data } = result;
    const response = await client.from("results").insert({ student_id:studentId, data }).select("id").single();
    throwIfError(response);
    return response.data.id;
  }

  async function deleteResults(studentId, topic = null) {
    const response = topic
      ? await client.rpc("delete_topic_results", { target_student:studentId, target_topic:topic })
      : await client.from("results").delete().eq("student_id", studentId);
    throwIfError(response);
  }

  async function manageStudent(action, values) {
    if (["create", "profile", "username"].includes(action) && /[æøå]/.test(normalizeUsername(values.username))) {
      // GitHub Pages and Edge Functions deploy independently. Do not let an
      // older server create a Unicode account with an incompatible auth alias.
      const support = await client.functions.invoke("manage-student", { body:{ action:"capabilities" } });
      if (support.error || !support.data?.danishUsernames) {
        throw new Error("Brugernavne med æ, ø og å afventer opdatering af elevadministrationen i Supabase.");
      }
    }
    const response = await client.functions.invoke("manage-student", { body:{ action, ...values } });
    throwIfError(response);
    if (response.data?.error) throw new Error(response.data.error);
    return response.data;
  }

  async function changeOwnPassword(username, currentPassword, password) {
    const signedIn = await client.auth.signInWithPassword({ email:await emailForUsername(username), password:currentPassword });
    throwIfError(signedIn);
    const response = await client.auth.updateUser({ password });
    throwIfError(response);
  }

  window.JacobBackend = {
    configured,
    // Share the existing authenticated client with ephemeral game rooms.
    realtimeClient:client,
    signIn,
    signUp,
    listSelfRegistered,
    assignSelfRegistered,
    signOut,
    loadDatabase,
    loadResults,
    saveSchoolState,
    loadSchoolState,
    appendResult,
    deleteResults,
    manageStudent,
    changeOwnPassword,
  };
})();
