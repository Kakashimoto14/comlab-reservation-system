# Supabase Edge Function scaffold

The scaffold provides a public health endpoint and an authenticated, read-only
laboratory-list endpoint. It does not replace or alter the existing
Express/DigitalOcean backend.

## Local verification

With the Supabase CLI installed and the local Supabase stack running, execute:

```powershell
supabase start
supabase functions serve api --no-verify-jwt
```

In a second PowerShell terminal, verify the health endpoint:

```powershell
Invoke-RestMethod http://127.0.0.1:54321/functions/v1/api/health
```

Expected response:

```json
{"status":"ok"}
```

Verify the read-only laboratories endpoint with a valid Supabase Auth access token:

```powershell
Invoke-RestMethod http://127.0.0.1:54321/functions/v1/api/laboratories `
  -Headers @{ Authorization = "Bearer <USER_ACCESS_TOKEN>" }
```

The response is a JSON array of the existing `public."Laboratory"` records,
ordered by `id` ascending. The query executes in the authenticated caller's RLS
context, so it may be empty or return an RLS error until policies are configured.
