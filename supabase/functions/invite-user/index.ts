import { withSupabase } from "jsr:@supabase/server@1";

interface ReqPayload {
  email: string;
  role: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default {
  // CHANGED FROM "none" TO "required" TO ALLOW AUTH CONTEXT
  fetch: withSupabase({ auth: "required" }, async (req, ctx) => {
    
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (!ctx.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Missing user context" }), 
          { status: 401, headers: corsHeaders }
        );
    }

    try {
      const { email, role } = await req.json() as ReqPayload;

      if (!email || !role) {
        return Response.json(
          { error: "Missing email or role parameter." }, 
          { status: 400, headers: corsHeaders } 
        );
      }

      const { data: authData, error: authError } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(email);
      if (authError) throw authError;

    // Sync user profile safely by providing the required primary key
      const { error: dbError } = await ctx.supabaseAdmin
      .from('profiles')
      .insert([
        {
          auth_id: authData.user.id,   
          name: email.split('@')[0],
          type: role,
          category: 'Admin'
        }
      ]);

      if (dbError) throw dbError;

      return Response.json(
        { success: true, message: "Invitation sent and profile synced!" }, 
        { headers: corsHeaders }
      );

    } catch (error: any) {
      return Response.json(
        { error: error.message }, 
        { status: 400, headers: corsHeaders }
      );
    }
  })
}