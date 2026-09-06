import { createSupabaseContext } from "npm:@supabase/server@^1";

import { corsHeaders, json } from "../_shared/http.ts";

const isHealthRequest = (pathname: string) =>
  pathname === "/health" || pathname.endsWith("/api/health");
const isLaboratoriesRequest = (pathname: string) =>
  pathname === "/laboratories" || pathname.endsWith("/api/laboratories");

const laboratoryFields =
  "id,name,roomCode,building,location,capacity,computerCount,description,status,imageUrl,custodianId,createdAt,updatedAt";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  const { pathname } = new URL(request.url);

  if (request.method === "GET" && isHealthRequest(pathname)) {
    return json({ status: "ok" });
  }

  if (request.method === "GET" && isLaboratoriesRequest(pathname)) {
    const { data: context, error: authenticationError } = await createSupabaseContext(request, {
      auth: "user"
    });

    if (authenticationError || !context) {
      return json({ message: "Authentication required." }, { status: 401 });
    }

    try {
      const { data, error } = await context.supabase
        .from("Laboratory")
        .select(laboratoryFields)
        .order("id", { ascending: true });

      if (error) {
        console.error("Failed to list laboratories.", {
          message: error.message,
          code: error.code,
          details: error.details
        });
        return json({ message: "Unable to load laboratories." }, { status: 500 });
      }

      return json(data ?? []);
    } catch {
      console.error("Failed to list laboratories.");
      return json({ message: "Unable to load laboratories." }, { status: 500 });
    }
  }

  return json({ message: "Not found." }, { status: 404 });
});
