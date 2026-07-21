// Sulap Artisan — admin-manage Edge Function
// =============================================================================
// The one privileged server-side call the app needs: creating another
// person's auth account, resetting someone else's password, or removing an
// admin account entirely. None of these are possible from the browser's anon
// key no matter what RLS allows — RLS governs table ROWS, not auth.users
// identity, and only the service_role key can call supabase.auth.admin.*.
//
// Every request must carry the CALLER's own access token (Authorization:
// Bearer <token>, which supabase-js's functions.invoke() attaches
// automatically from the active session) — verified against an anon-key
// client scoped to that token (so RLS's profiles_self_read applies), NOT
// trusted from the request body. Only a caller whose own profile has
// role='super' may perform any of these three actions.
//
// Deploy with: supabase functions deploy admin-manage
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically by the Supabase platform — no manual secret-setting needed.)
// =============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Missing authorization' }, 401);

    // Verify the CALLER via their own JWT against the anon client — RLS's
    // profiles_self_read means this only ever returns the caller's own row,
    // regardless of what id they might claim in the request body.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: 'Invalid session' }, 401);

    const { data: callerProfile, error: profErr } = await callerClient
      .from('profiles').select('role').eq('id', userData.user.id).single();
    if (profErr || callerProfile?.role !== 'super') {
      return json({ error: 'Super admin access required' }, 403);
    }

    const { action, ...payload } = await req.json();
    // Privileged client — only ever used AFTER the super-admin check above.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (action === 'createAdmin') {
      const { email, password, name, role, staffId } = payload as {
        email?: string; password?: string; name?: string; role?: string; staffId?: string;
      };
      if (!email || !password || !name) return json({ error: 'Missing required fields' }, 400);
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { name },
      });
      if (createErr) return json({ error: createErr.message }, 400);
      const newId = created.user.id;
      // The signup trigger already inserted a profiles row forced to
      // role='vendor' — promote it. Allowed under service_role thanks to
      // migration 0015's trigger update.
      const { error: updateErr } = await admin.from('profiles')
        .update({ role: role === 'super' ? 'super' : 'staff', name, staff_id: staffId || null })
        .eq('id', newId);
      if (updateErr) return json({ error: updateErr.message }, 400);
      return json({ id: newId });
    }

    if (action === 'resetPassword') {
      const { userId, newPassword } = payload as { userId?: string; newPassword?: string };
      if (!userId || !newPassword) return json({ error: 'Missing required fields' }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'removeAdmin') {
      const { userId } = payload as { userId?: string };
      if (!userId) return json({ error: 'Missing userId' }, 400);
      if (userId === userData.user.id) {
        return json({ error: "You can't remove your own account — transfer super admin first" }, 400);
      }
      // Never remove the last remaining super admin.
      const { data: target } = await admin.from('profiles').select('role').eq('id', userId).single();
      if (target?.role === 'super') {
        const { count } = await admin.from('profiles')
          .select('id', { count: 'exact', head: true }).eq('role', 'super');
        if ((count || 0) <= 1) return json({ error: 'Cannot remove the last super admin' }, 400);
      }
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
