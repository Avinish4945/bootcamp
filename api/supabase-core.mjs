async function selectFromSupabase(url, key, table, columns, filters = [], orderBy) {
  const endpoint = new URL(url.replace(/\/+$/, "") + "/rest/v1/" + table);
  endpoint.searchParams.set("select", columns);
  for (const [column, value] of filters) {
    endpoint.searchParams.set(column, "eq." + value);
  }
  if (orderBy) endpoint.searchParams.set("order", orderBy);

  let response;
  try {
    response = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        Accept: "application/json"
      }
    });
  } catch (error) {
    throw new Error("Could not reach Supabase: " + (error?.message || String(error)));
  }

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (error) {
    if (response.ok) throw new Error("Supabase returned invalid JSON: " + (error?.message || String(error)));
    body = { message: text || "Supabase request failed (" + response.status + ")." };
  }
  if (!response.ok) {
    const message = body && typeof body.message === "string"
      ? body.message
      : "Supabase request failed (" + response.status + ").";
    return { status: response.status, body: { error: message } };
  }
  return { status: response.status, body };
}

export async function handleSupabaseRequest(params, url, key) {
  const resource = params.resource;
  const companyId = params.company_id;
  if (!["companies", "company", "skills"].includes(resource)) {
    return { status: 400, body: { error: "Unknown data resource." } };
  }
  if (resource !== "companies" && (typeof companyId !== "string" || !companyId || companyId.length > 100)) {
    return { status: 400, body: { error: "A valid company_id is required." } };
  }
  if (typeof url !== "string" || typeof key !== "string" || !url || !key) {
    throw new Error("Supabase URL and anon key must be configured.");
  }
  if (new URL(url).protocol !== "https:") {
    throw new Error("SUPABASE_URL must use HTTPS.");
  }

  if (resource === "companies") {
    return selectFromSupabase(url, key, "company_json", "company_id,short_json", [], "company_id.asc");
  }
  if (resource === "company") {
    return selectFromSupabase(url, key, "company_json", "company_id,short_json,full_json", [["company_id", companyId]]);
  }

  const [levels, mastersRows, proficiencyRows, topicsRows] = await Promise.all([
    selectFromSupabase(url, key, "company_skill_levels", "company_id,skill_set_id,required_level,required_proficiency_level_id", [["company_id", companyId]]),
    selectFromSupabase(url, key, "skill_set_master", "skill_set_id,skill_set_name,short_name"),
    selectFromSupabase(url, key, "proficiency_levels", "proficiency_level_id,proficiency_name,proficiency_code"),
    selectFromSupabase(url, key, "skill_set_topics", "skill_set_id,level_number,topics", [], "level_number.asc")
  ]);
  const failedResult = [levels, mastersRows, proficiencyRows, topicsRows].find(result => result.status < 200 || result.status >= 300);
  if (failedResult) return failedResult;
  return {
    status: 200,
    body: {
      levels: levels.body,
      mastersRows: mastersRows.body,
      proficiencyRows: proficiencyRows.body,
      topicsRows: topicsRows.body
    }
  };
}
