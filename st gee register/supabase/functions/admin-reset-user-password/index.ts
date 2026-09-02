import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:corsHeaders});
Deno.serve(async req=>{
 if(req.method==='OPTIONS') return new Response('ok',{status:200,headers:corsHeaders});
 if(req.method!=='POST') return reply(405,{success:false,error:'POST required.'});
 try{
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if(!url||!key)return reply(500,{success:false,error:'Missing Supabase service-role configuration.'});
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim(); if(!token)return reply(401,{success:false,error:'Admin session required.'});
  const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:me,error:meError}=await admin.auth.getUser(token); if(meError||!me.user)return reply(401,{success:false,error:'Invalid admin session.'});
  const {data:profile}=await admin.from('profiles').select('role,active').eq('id',me.user.id).maybeSingle(); if(profile?.role!=='admin'||profile?.active!==true)return reply(403,{success:false,error:'Admin access required.'});
  const body=await req.json(); const userId=String(body.user_id||''); const password=String(body.password||''); if(!userId||password.length<8)return reply(400,{success:false,error:'User ID and a password of at least 8 characters are required.'});
  const {error}=await admin.auth.admin.updateUserById(userId,{password}); if(error)return reply(400,{success:false,error:error.message});
  return reply(200,{success:true});
 }catch(e){return reply(500,{success:false,error:e instanceof Error?e.message:String(e)})}
});
