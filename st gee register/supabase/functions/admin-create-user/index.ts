import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:corsHeaders});
function normalizeLogin(v:string){return v.trim().toLowerCase().replace(/[^a-z0-9._-]/g,'');}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS') return new Response('ok',{status:200,headers:corsHeaders});
 if(req.method!=='POST') return reply(405,{success:false,error:'POST required.'});
 try{
  const url=Deno.env.get('SUPABASE_URL'), key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key) return reply(500,{success:false,error:'Edge Function is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.'});
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
  if(!token) return reply(401,{success:false,error:'No login session was supplied.'});
  const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:authData,error:authError}=await admin.auth.getUser(token);
  if(authError||!authData.user) return reply(401,{success:false,error:`Session validation failed: ${authError?.message||'user not found'}`});
  const {data:caller,error:callerError}=await admin.from('profiles').select('role,active').eq('id',authData.user.id).maybeSingle();
  if(callerError) return reply(500,{success:false,error:`Could not read admin profile: ${callerError.message}`});
  if(!caller||caller.role!=='admin'||caller.active!==true) return reply(403,{success:false,error:'Admin access required. Set the logged-in profile role to admin and active=true.'});
  const body=await req.json().catch(()=>null); if(!body) return reply(400,{success:false,error:'Invalid request body.'});
  const login=normalizeLogin(String(body.login_name??'')); const fullName=String(body.full_name??'').trim(); const phone=String(body.phone??'').trim()||null;
  const role=String(body.role??'').trim().toLowerCase(); const section=body.section?String(body.section).trim():null; const grade=body.grade?String(body.grade).trim():null; const stream=body.stream?String(body.stream).trim():null; const password=String(body.password??'');
  if(!login||!fullName||!role) return reply(400,{success:false,error:'Login name, full name and role are required.'});
  if(password.length<8) return reply(400,{success:false,error:'Password must be at least 8 characters.'});
  if(!['admin','teacher','viewer'].includes(role)) return reply(400,{success:false,error:'Invalid role.'});
  if(role==='teacher'&&(!section||!grade||!stream)) return reply(400,{success:false,error:'A class teacher must have section, class/grade and stream.'});
  const {data:dupProfile}=await admin.from('profiles').select('id').ilike('login_name',login).maybeSingle();
  if(dupProfile) return reply(409,{success:false,error:`Login name ${login} is already in use.`});
  const suppliedEmail=String(body.email??'').trim().toLowerCase();
  const email=suppliedEmail||`${login}@stgeorges.local`;
  const {data:existing}=await admin.auth.admin.listUsers({page:1,perPage:1000});
  if(existing?.users?.some(u=>(u.email||'').toLowerCase()===email)) return reply(409,{success:false,error:'An Auth account already exists for this login/email.'});
  const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{login_name:login,full_name:fullName}});
  if(createError||!created.user) return reply(400,{success:false,error:`Auth account creation failed: ${createError?.message||'unknown error'}`});
  const {error:profileError}=await admin.from('profiles').insert({id:created.user.id,login_name:login,full_name:fullName,email:suppliedEmail||email,phone,role,section:role==='teacher'?section:null,grade:role==='teacher'?grade:null,stream:role==='teacher'?stream:null,active:true});
  if(profileError){await admin.auth.admin.deleteUser(created.user.id);return reply(400,{success:false,error:`Auth account was created but profile could not be saved: ${profileError.message}`});}
  return reply(200,{success:true,user_id:created.user.id,login_name:login,email});
 }catch(error){return reply(500,{success:false,error:error instanceof Error?error.message:String(error)})}
});
