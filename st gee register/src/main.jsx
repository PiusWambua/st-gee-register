import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './lib/supabase';
import * as XLSX from 'xlsx';
import './style.css';

const LEVELS = {
  ECDE:['PP1','PP2'],
  Primary:['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6'],
  JSS:['Grade 7','Grade 8','Grade 9']
};
const STREAMS = {
  ECDE:[],
  Primary:['PE','PK','PL','PR','PS'],
  JSS:['JE','JK','JL','JR','JS']
};
const ALL_GRADES = Object.values(LEVELS).flat();
const ALL_SECTIONS = Object.keys(LEVELS);
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const norm=v=>String(v??'').trim().toLowerCase();
const roleLabel=r=>r==='teacher'?'CLASS TEACHER':r==='admin'?'ADMIN':'VIEWER';
const residenceLabel=v=>norm(v).includes('board')?'Boarder':'Day Scholar';
const genderIs=(v,g)=>g==='boys'?['male','boy','boys','m'].includes(norm(v)):['female','girl','girls','f'].includes(norm(v));
const DEFAULT_SETTINGS={schoolName:"St. George's Comprehensive School",appName:'Digital Attendance Register',compactTables:false};
function getSettings(){try{return {...DEFAULT_SETTINGS,...JSON.parse(localStorage.getItem('stg_display_settings')||'{}')}}catch{return DEFAULT_SETTINGS}}
function saveSettings(s){localStorage.setItem('stg_display_settings',JSON.stringify(s))}
function loginEmail(v){const x=v.trim().toLowerCase();return x.includes('@')?x:`${x.replace(/[^a-z0-9._-]/g,'')}@stgeorges.local`}

export default function App(){
 const [session,setSession]=useState(null),[profile,setProfile]=useState(null),[loading,setLoading]=useState(true),[page,setPage]=useState('dashboard'),[msg,setMsg]=useState(''),[settings,setSettings]=useState(getSettings);
 useEffect(()=>{if(!msg)return;const timer=setTimeout(()=>setMsg(''),4500);return()=>clearTimeout(timer)},[msg]);
 useEffect(()=>{let alive=true;supabase.auth.getSession().then(({data})=>{if(alive)setSession(data.session);setLoading(false)});const {data}=supabase.auth.onAuthStateChange((_e,s)=>alive&&setSession(s));return()=>{alive=false;data.subscription.unsubscribe()}},[]);
 useEffect(()=>{if(!session){setProfile(null);return}setLoading(true);supabase.from('profiles').select('*').eq('id',session.user.id).maybeSingle().then(async({data,error})=>{if(error){setMsg('Could not load your profile: '+error.message);setLoading(false);return}const expected=localStorage.getItem('stg_expected_role');if(expected&&(!data||data.role!==expected)){localStorage.removeItem('stg_expected_role');await supabase.auth.signOut();setProfile(null);setLoading(false);setMsg(`This account is not a ${expected==='admin'?'ADMIN':'CLASS TEACHER'} account. Please use the correct login.`);return}localStorage.removeItem('stg_expected_role');setProfile(data||null);setLoading(false)})},[session]);
 if(!session)return <Login msg={msg} show={setMsg}/>;
 if(loading)return <Loading/>;
 if(!profile)return <Login msg="Your account has no active staff profile." show={setMsg}/>;
 if(profile.active===false)return <Blocked/>;
 const admin=profile.role==='admin',teacher=profile.role==='teacher';
 if(!admin&&!teacher)return <Blocked text="Only Admin and Class Teacher accounts can use this register."/>;
 const nav=[['dashboard','Dashboard','▦'],['learners','Learners','♙'],['attendance','Mark Attendance','✓'],['reports','Reports','▤'],['profile','My Profile','◉']];
 if(admin)nav.push(['classes','Classes & Streams','▦'],['users','User Management','♟'],['academic','Academic Year','↻'],['settings','Display Settings','⚙']);
 return <div className={settings.compactTables?'app compact':'app'}>
   <aside><div><div className="brand"><div className="logoBox"><img src="/school-logo.png" alt="St. George's School"/></div><div><h1>St. George's</h1><div>Digital Register</div></div></div><div className="user"><b>{profile.full_name||session.user.email}</b><small>{roleLabel(profile.role)}{teacher&&profile.grade?` • ${profile.grade} ${profile.stream||''}`:''}</small></div>{nav.map(([id,label,icon])=><button key={id} className={page===id?'nav active':'nav'} onClick={()=>{setPage(id);setMsg('')}}><span>{icon}</span>{label}</button>)}</div><button className="nav logout" onClick={()=>supabase.auth.signOut()}><span>↪</span>Sign out</button></aside>
   <main><header><div><div className="eyebrow">ST. GEORGE'S SCHOOL</div><h2>{nav.find(x=>x[0]===page)?.[1]||'Dashboard'}</h2><span>{settings.schoolName} • {settings.appName}</span></div><div className="headerUser"><img src={profile.avatar_url||'/school-logo.png'} alt="Profile"/><div><b>{profile.full_name||'Staff'}</b><small>{roleLabel(profile.role)}</small></div></div></header>{msg&&<div className="message autoDismiss" role="status">{msg}</div>}
   {page==='dashboard'&&<Dashboard profile={profile} admin={admin} settings={settings}/>}
   {page==='learners'&&<Learners profile={profile} admin={admin} show={setMsg}/>} 
   {page==='attendance'&&<Attendance profile={profile} show={setMsg}/>} 
   {page==='reports'&&<Reports profile={profile} show={setMsg}/>} 
   {page==='profile'&&<Profile profile={profile} setProfile={setProfile} session={session} show={setMsg}/>} 
   {page==='users'&&admin&&<Users show={setMsg}/>} {page==='classes'&&admin&&<Classes show={setMsg}/>} {page==='academic'&&admin&&<AcademicYear show={setMsg}/>} {page==='settings'&&admin&&<DisplaySettings settings={settings} setSettings={setSettings} show={setMsg}/>} 
   <footer className="appFooter">Designed by Pius Wambua</footer></main>
 </div>
}

function Loading(){return <div className="login"><div className="loginCard centered"><img className="loginLogo" src="/school-logo.png" alt="St. George's School"/><h1>St. George's</h1><p>Loading Digital Register…</p></div></div>}
function Blocked({text='This account is inactive. Please contact the administrator.'}){return <div className="login"><div className="loginCard centered"><img className="loginLogo" src="/school-logo.png" alt="St. George's School"/><h2>Access restricted</h2><p>{text}</p><button onClick={()=>supabase.auth.signOut()}>Return to Login</button></div></div>}

function Login({show,msg}){
 const [role,setRole]=useState('admin'),[login,setLogin]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[reset,setReset]=useState(false);
 async function submit(e){e.preventDefault();if(!login.trim()||!password)return;setBusy(true);localStorage.setItem('stg_expected_role',role);const {error}=await supabase.auth.signInWithPassword({email:loginEmail(login),password});setBusy(false);if(error){localStorage.removeItem('stg_expected_role');show(error.message.includes('Invalid login credentials')?'Invalid login name or password.':error.message)}}
 async function forgot(){if(!login.trim())return show('Enter your login name first.');setBusy(true);const {error}=await supabase.auth.resetPasswordForEmail(loginEmail(login),{redirectTo:window.location.origin});setBusy(false);if(error)show(error.message);else show('Password reset email sent.')}
 return <div className="login"><div className="loginCard loginWide"><img className="loginLogo" src="/school-logo.png" alt="St. George's School"/><div className="loginSchool">THE ST. GEORGES SCHOOL</div><h1>Digital Attendance Register</h1><p className="muted center">Select the account type before signing in.</p><div className="roleSwitch"><button type="button" className={role==='admin'?'roleChoice adminChoice selected':''} onClick={()=>setRole('admin')}>🛡️<b>Administrator</b><small>Whole school & system management</small></button><button type="button" className={role==='teacher'?'roleChoice selected':''} onClick={()=>setRole('teacher')}>👨‍🏫<b>Class Teacher</b><small>Attendance for assigned class & stream</small></button></div>{!reset?<form className="loginForm" onSubmit={submit}><label>{role==='teacher'?'Class Teacher Login':'Administrator Login'}<input value={login} onChange={e=>setLogin(e.target.value)} placeholder={role==='teacher'?'e.g. 8JE':'Admin login name'} autoCapitalize="none" required/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.targ
