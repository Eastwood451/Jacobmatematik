(() => {
  "use strict";

  const config = window.JACOBMATEMATIK_SUPABASE || {};
  const configured = Boolean(config.url && config.publishableKey && window.supabase?.createClient);
  const client = configured ? window.supabase.createClient(config.url, config.publishableKey) : null;
  const loginDomain = "users.jacobmatematik.invalid";
  const emailForUsername = username => `${String(username).trim().toLowerCase()}@${loginDomain}`;
  const withoutSecrets = user => {
    const { password, ...safeUser } = user;
    return safeUser;
  };
  const throwIfError = ({ error }) => { if (error) throw error; };

  async function signIn(username, password) {
    const response = await client.auth.signInWithPassword({ email:emailForUsername(username), password });
    throwIfError(response);
    return loadDatabase();
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
    const resultResponse = await client.from("results").select("id,student_id,data,created_at").order("created_at", { ascending:true });
    throwIfError(resultResponse);
    const school = (profile.role === "teacher" ? stateResponse.data?.data : stateResponse.data) || { classes:[], users:[] };
    const users = (school.users || []).map(item => ({ ...item, results:[] }));
    const current = users.find(item => item.id === profile.id);
    if (!current) users.push({ ...profile, classId:null, results:[] });
    (resultResponse.data || []).forEach(row => {
      const student = users.find(item => item.id === row.student_id);
      if (student) student.results.push({ ...row.data, remoteId:row.id });
    });
    return {
      database:{ classes:school.classes || [], users },
      currentUserId:profile.id,
    };
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
    let query = client.from("results").select("id,student_id,data,created_at").order("created_at", { ascending:true });
    if (after) query=query.gte("created_at",after);
    const response = await query;
    throwIfError(response);
    return (response.data || []).map(row => ({ ...row.data, remoteId:row.id, studentId:row.student_id, createdAt:row.created_at }));
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
    const response = await client.functions.invoke("manage-student", { body:{ action, ...values } });
    throwIfError(response);
    if (response.data?.error) throw new Error(response.data.error);
    return response.data;
  }

  async function changeOwnPassword(username, currentPassword, password) {
    const signedIn = await client.auth.signInWithPassword({ email:emailForUsername(username), password:currentPassword });
    throwIfError(signedIn);
    const response = await client.auth.updateUser({ password });
    throwIfError(response);
  }

  window.JacobBackend = {
    configured,
    signIn,
    signOut,
    loadDatabase,
    loadResults,
    saveSchoolState,
    appendResult,
    deleteResults,
    manageStudent,
    changeOwnPassword,
  };
})();
