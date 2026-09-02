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
 return <div className="login"><div className="loginCard loginWide"><img className="loginLogo" src="/school-logo.png" alt="St. George's School"/><div className="loginSchool">THE ST. GEORGES SCHOOL</div><h1>Digital Attendance Register</h1><p className="muted center">Select the account type before signing in.</p><div className="roleSwitch"><button type="button" className={role==='admin'?'roleChoice adminChoice selected':''} onClick={()=>setRole('admin')}>🛡️<b>Administrator</b><small>Whole school & system management</small></button><button type="button" className={role==='teacher'?'roleChoice selected':''} onClick={()=>setRole('teacher')}>👨‍🏫<b>Class Teacher</b><small>Attendance for assigned class & stream</small></button></div>{!reset?<form className="loginForm" onSubmit={submit}><label>{role==='teacher'?'Class Teacher Login':'Administrator Login'}<input value={login} onChange={e=>setLogin(e.target.value)} placeholder={role==='teacher'?'e.g. 8JE':'Admin login name'} autoCapitalize="none" required/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><button disabled={busy}>{busy?'Signing in…':`Sign in as ${role==='teacher'?'Class Teacher':'Administrator'}`}</button><button type="button" className="linkButton" onClick={()=>setReset(true)}>Forgot password?</button></form>:<div className="resetBox"><label>Login Name<input value={login} onChange={e=>setLogin(e.target.value)} placeholder="Your login name"/></label><button disabled={busy} onClick={forgot}>{busy?'Sending…':'Send reset email'}</button><button className="linkButton" onClick={()=>setReset(false)}>Back to sign in</button></div>}{msg&&<div className="error autoDismiss" role="alert">{msg}</div>}<p className="hint">Administrator accounts cannot enter through the Class Teacher login, and Class Teacher accounts cannot enter through the Administrator login.</p></div></div>
}

function Dashboard({profile,admin,settings}){
 const teacher=profile.role==='teacher';
 const [date,setDate]=useState(today());
 const [view,setView]=useState(teacher?'stream':'whole');
 const [selectedGrade,setSelectedGrade]=useState(teacher?profile.grade||'':'');
 const [selectedStream,setSelectedStream]=useState(teacher?profile.stream||'':'');
 const [selectedLearner,setSelectedLearner]=useState('');
 const [allLearners,setAllLearners]=useState([]);
 const [learners,setLearners]=useState([]);
 const [attendance,setAttendance]=useState([]);
 const [error,setError]=useState('');

 useEffect(()=>{
   if(!error)return;
   const timer=setTimeout(()=>setError(''),4500);
   return()=>clearTimeout(timer);
 },[error]);

 useEffect(()=>{
   (async()=>{
     let q=supabase
       .from('learners')
       .select('id,full_name,grade,stream,section,gender,residence,admission_no,nemis_no')
       .eq('active',true);
     if(teacher) q=q.eq('grade',profile.grade||'').eq('stream',profile.stream||'');
     const {data,error}=await q.order('full_name');
     if(error){setError(error.message);return;}
     setAllLearners(data||[]);
   })();
 },[profile,teacher]);

 const selectedSection=useMemo(()=>{
   for(const [section,grades] of Object.entries(LEVELS)){
     if(grades.includes(selectedGrade))return section;
   }
   return '';
 },[selectedGrade]);

 const availableStreams=useMemo(()=>{
   if(selectedSection)return STREAMS[selectedSection]||[];
   return [...new Set([...STREAMS.Primary,...STREAMS.JSS])];
 },[selectedSection]);

 const availableLearners=useMemo(()=>{
   let rows=[...allLearners];
   if(selectedGrade)rows=rows.filter(x=>x.grade===selectedGrade);
   if(selectedStream)rows=rows.filter(x=>x.stream===selectedStream);
   return rows.sort((a,b)=>String(a.full_name||'').localeCompare(String(b.full_name||'')));
 },[allLearners,selectedGrade,selectedStream]);

 useEffect(()=>{
   if(selectedStream && !availableStreams.includes(selectedStream))setSelectedStream('');
 },[availableStreams,selectedStream]);

 useEffect(()=>{
   if(view==='grade' && !selectedGrade)setSelectedGrade(ALL_GRADES[0]);
 },[view,selectedGrade]);

 useEffect(()=>{
   if(view!=='individual')setSelectedLearner('');
 },[view]);

 async function load(){
   let q=supabase
     .from('learners')
     .select('id,full_name,admission_no,nemis_no,gender,residence,section,grade,stream')
     .eq('active',true);

   if(teacher){
     q=q.eq('grade',profile.grade||'').eq('stream',profile.stream||'');
   }else if(view==='grade' && selectedGrade){
     q=q.eq('grade',selectedGrade);
   }else if(view==='stream' && selectedStream){
     if(selectedGrade)q=q.eq('grade',selectedGrade);
     q=q.eq('stream',selectedStream);
   }else if(view==='individual' && selectedLearner){
     q=q.eq('id',selectedLearner);
   }

   const {data,error}=await q.order('full_name');
   if(error){setError(error.message);return;}
   setLearners(data||[]);

   const ids=(data||[]).map(x=>x.id);
   if(!ids.length){setAttendance([]);return;}

   const {data:a,error:ae}=await supabase
     .from('attendance')
     .select('learner_id,status')
     .eq('attendance_date',date)
     .in('learner_id',ids);

   if(ae)setError(ae.message);
   else setAttendance(a||[]);
 }

 useEffect(()=>{load()},[date,view,selectedGrade,selectedStream,selectedLearner,profile]);

 const amap=useMemo(()=>Object.fromEntries(attendance.map(a=>[a.learner_id,a.status])),[attendance]);
 const stats=useMemo(()=>{
   const count=list=>({
     present:list.filter(x=>amap[x.id]==='Present').length,
     absent:list.filter(x=>amap[x.id]==='Absent').length,
     total:list.length
   });
   const boys=learners.filter(x=>genderIs(x.gender,'boys'));
   const girls=learners.filter(x=>genderIs(x.gender,'girls'));
   const board=learners.filter(x=>residenceLabel(x.residence)==='Boarder');
   const day=learners.filter(x=>residenceLabel(x.residence)==='Day Scholar');
   return{
     boys:count(boys), girls:count(girls), grand:count(learners),
     boarders:count(board), day:count(day),
     boarderBoys:count(board.filter(x=>genderIs(x.gender,'boys'))),
     boarderGirls:count(board.filter(x=>genderIs(x.gender,'girls'))),
     dayBoys:count(day.filter(x=>genderIs(x.gender,'boys'))),
     dayGirls:count(day.filter(x=>genderIs(x.gender,'girls')))
   };
 },[learners,amap]);

 const pct=stats.grand.total?Math.round(stats.grand.present/stats.grand.total*100):0;
 const selectedGradeStreams=selectedGrade?availableStreams:[];
 const selectedLabel=teacher
   ? `${profile.grade||''} • ${profile.stream||''}`
   : view==='whole' ? 'Whole School'
   : view==='grade' ? `${selectedGrade||'Select Grade'} • All Streams`
   : view==='stream' ? `${selectedGrade||'All Grades'} • ${selectedStream||'Select Stream'}`
   : availableLearners.find(l=>String(l.id)===String(selectedLearner))?.full_name||'Select Learner';
 const heading=teacher
   ? `My Stream — ${profile.grade||''} ${profile.stream||''}`
   : view==='whole' ? 'Whole School Attendance'
   : view==='grade' ? `${selectedGrade||'Grade'} Attendance`
   : view==='stream' ? `${selectedGrade||'All Grades'} • ${selectedStream||'Stream'} Attendance`
   : selectedLearner ? 'Individual Learner Attendance' : 'Individual Attendance';

 const Summary=({title,icon,tone,boys,girls,total})=><div className={`summaryPanel ${tone}`}>
   <div className="summaryTitle"><span>{icon}</span><b>{title}</b></div>
   <div className="summaryTable">
     <div className="summaryHead"><span>Gender</span><span>Present</span><span>Absent</span><span>Total</span></div>
     <div className="summaryRow"><span>👦 Boys</span><span>{boys.present}</span><span>{boys.absent}</span><span>{boys.total}</span></div>
     <div className="summaryRow"><span>👧 Girls</span><span>{girls.present}</span><span>{girls.absent}</span><span>{girls.total}</span></div>
     <div className="summaryRow totalRow"><span>{title} Total</span><span>{total.present}</span><span>{total.absent}</span><span>{total.total}</span></div>
   </div>
 </div>;

 return <>
   <div className="heroBar"><div><div className="eyebrow">ATTENDANCE DASHBOARD</div><h3>{heading}</h3><p>{settings.schoolName} • {date}</p>{!teacher&&<div className="selectedContext"><b>Selected:</b> {selectedLabel}</div>}</div><div className="heroRate"><strong>{pct}%</strong><span>Attendance Rate</span></div></div>

   <div className="card dashboardFilter">
     <div className="filterTitle"><div><h3>Find Attendance</h3><p className="muted">Search the whole school, grade, stream or individual learner.</p></div>
       {admin&&<button type="button" className={view==='whole'?'wholeSchoolBtn active':'wholeSchoolBtn'} onClick={()=>{setView('whole');setSelectedGrade('');setSelectedStream('');setSelectedLearner('')}}>🏫 Whole School Attendance</button>}
     </div>
     <div className="filterGrid dashboardControls">
       <label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
       {admin?<label>Search By<select value={view} onChange={e=>{const v=e.target.value;setView(v);setSelectedLearner('');if(v==='whole'){setSelectedGrade('');setSelectedStream('')}else if(v==='grade'){setSelectedStream('')}}}>
         <option value="whole">Whole School</option><option value="grade">Grade / Class</option><option value="stream">Stream</option><option value="individual">Individual Learner</option>
       </select></label>:<label>Assigned Class & Stream<input value={`${profile.grade||''} • ${profile.stream||''}`} readOnly/></label>}

       {admin&&view!=='whole'&&<label>Grade / Class<select value={selectedGrade} onChange={e=>{setSelectedGrade(e.target.value);setSelectedStream('');setSelectedLearner('');if(e.target.value)setView('grade')}}>
         <option value="">All Grades / Select Grade</option>
         <optgroup label="ECDE">{LEVELS.ECDE.map(g=><option key={g} value={g}>{g}</option>)}</optgroup>
         <optgroup label="Primary">{LEVELS.Primary.map(g=><option key={g} value={g}>{g}</option>)}</optgroup>
         <optgroup label="JSS">{LEVELS.JSS.map(g=><option key={g} value={g}>{g}</option>)}</optgroup>
       </select></label>}

       {admin&&view!=='whole'&&selectedGrade&&selectedSection!=='ECDE'&&<label>Stream<select value={selectedStream} onChange={e=>{const v=e.target.value;setSelectedStream(v);setSelectedLearner('');if(v)setView('stream');else setView('grade')}}>
         <option value="">All Streams — Entire {selectedGrade}</option>
         {availableStreams.map(s=><option key={s} value={s}>{selectedGrade} {s}</option>)}
       </select></label>}

       {admin&&view==='stream'&&!selectedGrade&&<label>Stream<select value={selectedStream} onChange={e=>{setSelectedStream(e.target.value);setSelectedLearner('')}}>
         <option value="">Select Stream</option>
         {availableStreams.map(s=><option key={s} value={s}>{s}</option>)}
       </select></label>}

       {admin&&view==='individual'&&<label>Individual Learner<select value={selectedLearner} onChange={e=>setSelectedLearner(e.target.value)}>
         <option value="">Select Learner</option>
         {availableLearners.map(l=><option key={l.id} value={l.id}>{l.full_name} — {l.grade||''} • {l.stream||''}</option>)}
       </select></label>}
     </div>

     {admin&&view!=='whole'&&selectedGrade&&<div className="availableStreamsBox">
       <div className="streamPickerTop"><div><b>{selectedSection==='ECDE'?`Classes in ${selectedGrade} — No Streams`:`Streams in ${selectedGrade}`}</b><span className="streamCount">{selectedSection==='ECDE'?'No streams':`${availableStreams.length} available`}</span></div></div>
       <div className="streamList">
         {selectedSection!=='ECDE'&&<button type="button" className={!selectedStream?'streamChip selected':'streamChip'} onClick={()=>{setSelectedStream('');setView('grade');setSelectedLearner('')}}>All {selectedGrade}</button>}
         {selectedSection!=='ECDE'&&availableStreams.map(s=><button type="button" key={s} className={selectedStream===s?'streamChip selected':'streamChip'} onClick={()=>{setSelectedStream(s);setView('stream');setSelectedLearner('')}}>{selectedGrade} {s}</button>)}
         {selectedSection==='ECDE'&&<span className="muted">ECDE classes have no stream selection. Selecting {selectedGrade} shows the entire class.</span>}
       </div>
     </div>}
   </div>

   {error&&<div className="card error autoDismiss" role="alert">Dashboard could not read data: {error}</div>}
   <div className="topStats"><Stat tone="boys" icon="👦" title="Total Boys" data={stats.boys}/><Stat tone="girls" icon="👧" title="Total Girls" data={stats.girls}/><Stat tone="grand" icon="👥" title="Grand Total" data={stats.grand}/></div>
   <div className="summaryGrid"><Summary title="BOARDERS" icon="🛏️" tone="blue" boys={stats.boarderBoys} girls={stats.boarderGirls} total={stats.boarders}/><Summary title="DAY SCHOLARS" icon="🏫" tone="green" boys={stats.dayBoys} girls={stats.dayGirls} total={stats.day}/></div>
   <div className="summaryPanel purple schoolTotal"><div className="summaryTitle"><span>🏫</span><b>SCHOOL TOTAL</b></div><div className="summaryTable"><div className="summaryHead"><span>Gender</span><span>Present</span><span>Absent</span><span>Total</span></div><div className="summaryRow"><span>👦 Total Boys</span><span>{stats.boys.present}</span><span>{stats.boys.absent}</span><span>{stats.boys.total}</span></div><div className="summaryRow"><span>👧 Total Girls</span><span>{stats.girls.present}</span><span>{stats.girls.absent}</span><span>{stats.girls.total}</span></div><div className="summaryRow grandRow"><span>GRAND TOTAL</span><span>{stats.grand.present}</span><span>{stats.grand.absent}</span><span>{stats.grand.total}</span></div></div></div>
 </>;
}
function Stat({tone,icon,title,data}){return <div className={`bigStat ${tone}`}><span>{icon}</span><div><small>{title}</small><strong>{data.total}</strong><p>Present {data.present} · Absent {data.absent}</p></div></div>}

function Learners({profile,admin,show}){
 const teacher=profile.role==='teacher';const [section,setSection]=useState(teacher?profile.section||'JSS':'JSS'),[grade,setGrade]=useState(teacher?profile.grade||'Grade 8':'Grade 7'),[stream,setStream]=useState(teacher?profile.stream||'':''),[search,setSearch]=useState(''),[rows,setRows]=useState([]),[busy,setBusy]=useState(false),[form,setForm]=useState({admission_no:'',nemis_no:'',full_name:'',gender:'Male',residence:'Day Scholar',section:teacher?profile.section||'JSS':'JSS',grade:teacher?profile.grade||'Grade 8':'Grade 7',stream:teacher?profile.stream||'':''});
 async function load(){setBusy(true);let q=supabase.from('learners').select('id,admission_no,nemis_no,full_name,gender,residence,section,grade,stream,active').eq('active',true);if(teacher)q=q.eq('grade',profile.grade||'').eq('stream',profile.stream||'');else{q=q.eq('section',section).eq('grade',grade);if(stream)q=q.eq('stream',stream)}const {data,error}=await q.order('full_name');setBusy(false);if(error)return show('Could not load learners: '+error.message);setRows(data||[])}
 useEffect(()=>{load()},[section,grade,stream,profile]);
 const visible=rows.filter(r=>[r.full_name,r.admission_no,r.nemis_no,r.stream].some(v=>norm(v).includes(norm(search))));
 async function add(e){e.preventDefault();if(teacher&&form.stream!==profile.stream)return show('You can only add learners to your assigned stream.');if(!form.full_name.trim())return show('Learner name is required.');const payload={admission_no:form.admission_no.trim()||null,nemis_no:form.nemis_no.trim()||null,full_name:form.full_name.trim(),gender:form.gender,residence:form.residence,section:teacher?profile.section:form.section,grade:teacher?profile.grade:form.grade,stream:teacher?profile.stream:form.stream.trim()||null,active:true};const {error}=await supabase.from('learners').insert(payload);if(error)return show('Could not save learner: '+error.message);show('Learner added.');setForm({...form,admission_no:'',nemis_no:'',full_name:''});load()}
 async function remove(id){if(!confirm('Remove this learner from the active register?'))return;const {error}=await supabase.from('learners').update({active:false}).eq('id',id);if(error)show(error.message);else{show('Learner removed from active register.');load()}}
 function importFile(e){const file=e.target.files?.[0];e.target.value='';if(!file)return;const reader=new FileReader();reader.onload=async ev=>{try{const wb=XLSX.read(ev.target.result,{type:'array'}),sheet=wb.Sheets[wb.SheetNames[0]],data=XLSX.utils.sheet_to_json(sheet);if(!data.length)return show('The spreadsheet is empty.');const payload=data.map(r=>({admission_no:String(r.Admission_No??r.Admission_Number??r['Adm Number']??'').trim()||null,nemis_no:String(r.NEMIS_Number??r.NEMIS??r['NEMIS Number']??'').trim()||null,full_name:String(r.Full_Name??r.Name??r['Full Name']??'').trim(),gender:String(r.Gender??'').trim()||null,residence:residenceLabel(r.Residence),section:teacher?profile.section:String(r.Section??r.section??form.section).trim(),grade:teacher?profile.grade:String(r.Class_Grade??r.Grade??r.grade??form.grade).trim(),stream:teacher?profile.stream:String(r.Stream??r.stream??'').trim()||null,active:true})).filter(r=>r.full_name);if(!payload.length)return show('No valid learner names were found.');const {error}=await supabase.from('learners').insert(payload);if(error)show('Import failed: '+error.message);else{show(`${payload.length} learners imported successfully.`);load()}}catch(err){show('Could not read spreadsheet: '+err.message)}};reader.readAsArrayBuffer(file)}
 function template(){const ws=XLSX.utils.json_to_sheet([{Admission_No:'1001',NEMIS_Number:'123456789',Full_Name:'Example Learner',Gender:'Male',Residence:'Day Scholar',Section:'JSS',Class_Grade:'Grade 8',Stream:'8JE'}]);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Learners');XLSX.writeFile(wb,'St_Georges_Learner_Import_Template.xlsx')}
 return <><div className="heroBar"><div><div className="eyebrow">LEARNER REGISTER</div><h3>{teacher?'My Assigned Learners':'Learners'}</h3><p>{rows.length} active learners</p></div><div className="heroActions"><button className="secondary" onClick={template}>Download CSV/Excel Template</button><label className="fileBtn">Import Excel<input type="file" accept=".xlsx,.xls" onChange={importFile}/></label></div></div>{admin||teacher?<div className="card"><h3>Add Learner</h3><form className="grid" onSubmit={add}><label>Admission Number<input value={form.admission_no} onChange={e=>setForm({...form,admission_no:e.target.value})}/></label><label>NEMIS Number<input value={form.nemis_no} onChange={e=>setForm({...form,nemis_no:e.target.value})}/></label><label>Full Name<input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} required/></label><label>Gender<select value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}><option>Male</option><option>Female</option></select></label><label>Residence<select value={form.residence} onChange={e=>setForm({...form,residence:e.target.value})}><option>Day Scholar</option><option>Boarder</option></select></label><label>Section{teacher?<input value={form.section} readOnly/>:<select value={form.section} onChange={e=>setForm({...form,section:e.target.value,grade:LEVELS[e.target.value][0]})}>{Object.keys(LEVELS).map(x=><option key={x}>{x}</option>)}</select>}</label><label>Class / Grade{teacher?<input value={form.grade} readOnly/>:<select value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})}>{LEVELS[form.section].map(x=><option key={x}>{x}</option>)}</select>}</label><label>Stream{teacher?<input value={form.stream} readOnly/>:<input value={form.stream} onChange={e=>setForm({...form,stream:e.target.value})} placeholder="8JE"/>}</label><div className="actions"><button disabled={busy}>{busy?'Saving…':'Add Learner'}</button></div></form></div>:null}<div className="card"><div className="toolbar"><div><h3>Learner List</h3><p className="muted">NEMIS number is used instead of UPI number.</p></div><div className="actions"><input className="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, admission or NEMIS…"/>{!teacher&&<><select value={section} onChange={e=>{setSection(e.target.value);setGrade(LEVELS[e.target.value][0]);setStream('')}}>{Object.keys(LEVELS).map(x=><option key={x}>{x}</option>)}</select><select value={grade} onChange={e=>setGrade(e.target.value)}>{LEVELS[section].map(x=><option key={x}>{x}</option>)}</select><input value={stream} onChange={e=>setStream(e.target.value)} placeholder="Stream"/></>}</div></div><Table headers={['#','Admission','NEMIS Number','Learner','Gender','Residence','Class','Stream','Action']} rows={visible.map((r,i)=>[i+1,r.admission_no||'—',r.nemis_no||'—',r.full_name,r.gender||'—',residenceLabel(r.residence),r.grade||'—',r.stream||'—',<button className="small danger" onClick={()=>remove(r.id)}>Remove</button>])}/></div></>
}

function Attendance({profile,show}){
 const teacher=profile.role==='teacher',canEdit=teacher||profile.role==='admin';const [date,setDate]=useState(today()),[section,setSection]=useState(teacher?profile.section||'JSS':'JSS'),[grade,setGrade]=useState(teacher?profile.grade||'Grade 8':'Grade 7'),[stream,setStream]=useState(teacher?profile.stream||'':''),[learners,setLearners]=useState([]),[status,setStatus]=useState({}),[busy,setBusy]=useState(false);
 async function load(){let q=supabase.from('learners').select('id,full_name,admission_no,nemis_no,stream').eq('active',true).eq('section',section).eq('grade',grade);if(teacher)q=q.eq('stream',profile.stream||'');else if(stream)q=q.eq('stream',stream);const {data,error}=await q.order('full_name');if(error)return show('Could not load attendance list: '+error.message);setLearners(data||[]);const ids=(data||[]).map(x=>x.id);if(!ids.length)return setStatus({});const {data:a,error:ae}=await supabase.from('attendance').select('learner_id,status').eq('attendance_date',date).in('learner_id',ids);if(ae)return show('Could not load attendance: '+ae.message);const m={};(a||[]).forEach(x=>m[x.learner_id]=x.status);setStatus(m)}
 useEffect(()=>{load()},[date,section,grade,stream,profile]);
 const markAll=s=>setStatus(Object.fromEntries(learners.map(l=>[l.id,s]))),markOne=(id,s)=>setStatus(p=>({...p,[id]:s}));
 async function save(){const unmarked=learners.filter(l=>!status[l.id]);if(unmarked.length)return show(`Please mark all learners. ${unmarked.length} still need a Present or Absent status.`);setBusy(true);const rows=learners.map(l=>({learner_id:l.id,attendance_date:date,status:status[l.id],marked_by:profile.id}));const {error}=await supabase.from('attendance').upsert(rows,{onConflict:'learner_id,attendance_date'});setBusy(false);if(error)show('Could not save attendance: '+error.message);else show('Attendance saved successfully.')}
 const present=learners.filter(l=>status[l.id]==='Present').length,absent=learners.filter(l=>status[l.id]==='Absent').length;
 return <><div className="card"><div className="filterGrid"><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Section{teacher?<input value={section} readOnly/>:<select value={section} onChange={e=>{setSection(e.target.value);setGrade(LEVELS[e.target.value][0]);setStream('')}}>{Object.keys(LEVELS).map(x=><option key={x}>{x}</option>)}</select>}</label><label>Class / Grade{teacher?<input value={grade} readOnly/>:<select value={grade} onChange={e=>setGrade(e.target.value)}>{LEVELS[section].map(x=><option key={x}>{x}</option>)}</select>}</label><label>Stream{teacher?<input value={stream} readOnly/>:<input value={stream} onChange={e=>setStream(e.target.value)} placeholder="All streams"/>}</label></div></div><div className="card attendanceCard"><div className="attendanceTop"><div><div className="eyebrow">PRESENT / ABSENT ONLY</div><h3>Mark Attendance</h3><p className="muted">{learners.length} learners • <b className="greenText">{present} present</b> • <b className="redText">{absent} absent</b></p></div><div className="bulkActions"><button className="presentBtn" disabled={!canEdit||!learners.length} onClick={()=>markAll('Present')}>✓ Mark All Present</button><button className="absentBtn" disabled={!canEdit||!learners.length} onClick={()=>markAll('Absent')}>✕ Mark All Absent</button><button disabled={!canEdit||busy||!learners.length} onClick={save}>{busy?'Saving…':'Save Attendance'}</button><button className="secondary" onClick={()=>window.print()}>Print</button></div></div><div className="attendanceList"><div className="attendanceHead"><span>#</span><span>Admission</span><span>NEMIS Number</span><span>Learner</span><span>Stream</span><span>Attendance</span></div>{learners.map((l,i)=><div className="attendanceRow" key={l.id}><span>{i+1}</span><span>{l.admission_no||'—'}</span><span>{l.nemis_no||'—'}</span><span className="learnerName">{l.full_name}</span><span>{l.stream||'—'}</span><span className="markButtons"><button className={status[l.id]==='Present'?'selected presentBtn':'presentBtn'} onClick={()=>markOne(l.id,'Present')}>✓ Present</button><button className={status[l.id]==='Absent'?'selected absentBtn':'absentBtn'} onClick={()=>markOne(l.id,'Absent')}>✕ Absent</button></span></div>)}{!learners.length&&<div className="empty">No learners found for this class/stream.</div>}</div></div></>
}

function Reports({profile,show}){const [date,setDate]=useState(today()),[rows,setRows]=useState([]);async function load(){let q=supabase.from('attendance').select('attendance_date,status,learners(full_name,admission_no,nemis_no,section,grade,stream,residence,gender)').eq('attendance_date',date);if(profile.role==='teacher')q=q.eq('learners.grade',profile.grade).eq('learners.stream',profile.stream||'');const {data,error}=await q;if(error)show('Could not load report: '+error.message);else setRows(data||[])}useEffect(()=>{load()},[date,profile]);const present=rows.filter(r=>r.status==='Present').length,absent=rows.filter(r=>r.status==='Absent').length;return <><div className="card"><div className="toolbar"><div><div className="eyebrow">ATTENDANCE REPORT</div><h3>{date}</h3><p className="muted">Present {present} • Absent {absent} • Total Marked {rows.length}</p></div><div className="actions"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><button onClick={()=>window.print()}>Print</button></div></div></div><div className="card"><Table headers={['Admission','NEMIS Number','Learner','Class','Stream','Residence','Gender','Status']} rows={rows.map(r=>[r.learners?.admission_no||'—',r.learners?.nemis_no||'—',r.learners?.full_name||'—',r.learners?.grade||'—',r.learners?.stream||'—',residenceLabel(r.learners?.residence),r.learners?.gender||'—',r.status])}/></div></>}

function Profile({profile,setProfile,session,show}){const [form,setForm]=useState({full_name:profile.full_name||'',phone:profile.phone||'',login_name:profile.login_name||''}),[avatar,setAvatar]=useState(profile.avatar_url||''),[oldPass,setOldPass]=useState(''),[newPass,setNewPass]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false);async function save(e){e.preventDefault();setBusy(true);const {data,error}=await supabase.from('profiles').update({full_name:form.full_name.trim(),phone:form.phone.trim()||null}).eq('id',profile.id).select().single();setBusy(false);if(error)show(error.message);else{setProfile(data);show('Profile updated.')}}async function upload(e){const f=e.target.files?.[0];e.target.value='';if(!f)return;if(!f.type.startsWith('image/'))return show('Please choose an image.');if(f.size>3*1024*1024)return show('Maximum 3 MB.');setBusy(true);const ext=(f.name.split('.').pop()||'jpg').toLowerCase(),path=`${profile.id}/avatar-${Date.now()}.${ext}`;const {error:up}=await supabase.storage.from('avatars').upload(path,f,{upsert:true,contentType:f.type});if(up){setBusy(false);return show(up.message)}const {data:pub}=supabase.storage.from('avatars').getPublicUrl(path);const {data,error}=await supabase.from('profiles').update({avatar_url:pub.publicUrl}).eq('id',profile.id).select().single();setBusy(false);if(error)show(error.message);else{setProfile(data);setAvatar(data.avatar_url)}}async function password(e){e.preventDefault();if(newPass.length<8)return show('Password must be at least 8 characters.');if(newPass!==confirm)return show('Passwords do not match.');setBusy(true);const {error:re}=await supabase.auth.signInWithPassword({email:session.user.email,password:oldPass});if(re){setBusy(false);return show('Current password is incorrect.')}const {error}=await supabase.auth.updateUser({password:newPass});setBusy(false);if(error)show(error.message);else{setOldPass('');setNewPass('');setConfirm('');show('Password changed successfully.')}}return <><div className="card"><div className="profileHero"><div className="avatar"><img src={avatar||'/school-logo.png'} alt="Profile"/></div><div><h3>{profile.full_name||'My Profile'}</h3><p className="muted">{roleLabel(profile.role)}{profile.grade?` • ${profile.grade} ${profile.stream||''}`:''}</p><label className="fileBtn">Upload Profile Picture<input type="file" accept="image/*" onChange={upload}/></label></div></div></div><div className="card"><h3>My Profile</h3><form className="grid" onSubmit={save}><label>Full Name<input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} required/></label><label>Login Name<input value={form.login_name} readOnly/></label><label>Email<input value={session.user.email||''} readOnly/></label><label>Phone<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>Role<input value={roleLabel(profile.role)} readOnly/></label>{profile.role==='teacher'&&<><label>Class / Grade<input value={profile.grade||''} readOnly/></label><label>Stream<input value={profile.stream||''} readOnly/></label></>}<div className="actions"><button disabled={busy}>Save Profile</button></div></form></div><div className="card"><h3>Change Password</h3><form className="grid" onSubmit={password}><label>Current Password<input type="password" value={oldPass} onChange={e=>setOldPass(e.target.value)} required/></label><label>New Password<input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} required/></label><label>Confirm New Password<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required/></label><div className="actions"><button disabled={busy}>Change Password</button></div></form></div></>}

function Users({show}){const empty={login_name:'',email:'',full_name:'',phone:'',role:'teacher',section:'JSS',grade:'Grade 8',stream:'',password:'',confirm:''};const [rows,setRows]=useState([]),[form,setForm]=useState(empty),[busy,setBusy]=useState(false);async function load(){const {data,error}=await supabase.from('profiles').select('*').order('full_name');if(error)show('Could not load users: '+error.message);else setRows(data||[])}useEffect(()=>{load()},[]);function gen(x){return `${x.trim().toLowerCase().replace(/[^a-z0-9._-]/g,'')}@stgeorges.local`}async function create(e){e.preventDefault();if(form.role==='teacher'&&!form.stream.trim())return show('A Class Teacher must have a stream.');if(form.password.length<8)return show('Password must be at least 8 characters.');if(form.password!==form.confirm)return show('Passwords do not match.');setBusy(true);try{const {data:sd}=await supabase.auth.getSession();const {data,error}=await supabase.functions.invoke('admin-create-user',{headers:{Authorization:`Bearer ${sd.session?.access_token||''}`},body:{login_name:form.login_name.trim(),email:form.email.trim()||gen(form.login_name),full_name:form.full_name.trim(),phone:form.phone.trim()||null,role:form.role,section:form.role==='teacher'?form.section:null,grade:form.role==='teacher'?form.grade:null,stream:form.role==='teacher'?form.stream.trim():null,password:form.password}});if(error)return show('Could not create user: '+error.message);if(!data?.success)return show('Could not create user: '+(data?.error||'Unknown error'));show(`User created. Login: ${form.login_name}`);setForm(empty);load()}finally{setBusy(false)}}async function toggle(r){const {error}=await supabase.from('profiles').update({active:!r.active}).eq('id',r.id);if(error)show(error.message);else load()}async function reset(r){const p=prompt(`Set a new password for ${r.login_name||r.full_name}:`);if(p===null)return;if(p.length<8)return show('Minimum 8 characters.');const {data:sd}=await supabase.auth.getSession();const {data,error}=await supabase.functions.invoke('admin-reset-user-password',{headers:{Authorization:`Bearer ${sd.session?.access_token||''}`},body:{user_id:r.id,password:p}});if(error)return show(error.message);if(!data?.success)return show(data?.error||'Reset failed');show('Password reset.')}return <><div className="card"><h3>Add Staff Account</h3><form className="grid" onSubmit={create}><label>Login Name<input value={form.login_name} onChange={e=>setForm({...form,login_name:e.target.value})} placeholder="8JE" required/></label><label>Full Name<input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} required/></label><label>Email (optional)<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Phone<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>Role<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="teacher">Class Teacher</option><option value="admin">Administrator</option></select></label>{form.role==='teacher'&&<><label>Section<select value={form.section} onChange={e=>setForm({...form,section:e.target.value,grade:LEVELS[e.target.value][0]})}>{Object.keys(LEVELS).map(x=><option key={x}>{x}</option>)}</select></label><label>Class / Grade<select value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})}>{LEVELS[form.section].map(x=><option key={x}>{x}</option>)}</select></label><label>Stream<input value={form.stream} onChange={e=>setForm({...form,stream:e.target.value})} required/></label></>}<label>Password<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/></label><label>Confirm Password<input type="password" value={form.confirm} onChange={e=>setForm({...form,confirm:e.target.value})} required/></label><div className="actions"><button disabled={busy}>{busy?'Creating…':'Create User'}</button></div></form></div><div className="card"><h3>Staff Accounts</h3><Table headers={['Login','Name','Role','Class / Stream','Status','Action']} rows={rows.map(r=>[r.login_name||'—',r.full_name||'—',roleLabel(r.role),r.role==='teacher'?`${r.grade||''} ${r.stream||''}`:'Whole School',r.active===false?'Inactive':'Active',<span className="rowActions"><button className="small secondary" onClick={()=>reset(r)}>Reset Password</button><button className="small secondary" onClick={()=>toggle(r)}>{r.active===false?'Activate':'Deactivate'}</button></span>])}/></div></>}

function Classes({show}){const [rows,setRows]=useState([]),[form,setForm]=useState({section:'JSS',grade:'Grade 7',stream:'JE'});async function load(){const {data,error}=await supabase.from('classes').select('*').order('section').order('grade').order('stream');if(error)show(error.message);else setRows(data||[])}useEffect(()=>{load()},[]);async function add(e){e.preventDefault();if(form.section!=='ECDE'&&!form.stream.trim())return show('Select a stream.');const {error}=await supabase.from('classes').insert({section:form.section,grade:form.grade,stream:form.section==='ECDE'?null:form.stream.trim()});if(error)show(error.message);else{show('Class/stream added.');setForm({...form,stream:form.section==='ECDE'?'':(STREAMS[form.section]?.[0]||'')});load()}}const streamOptions=STREAMS[form.section]||[];return <><div className="card"><h3>Add Class / Stream</h3><form className="grid" onSubmit={add}><label>Section<select value={form.section} onChange={e=>{const section=e.target.value;setForm({section,grade:LEVELS[section][0],stream:STREAMS[section]?.[0]||''})}}>{Object.keys(LEVELS).map(x=><option key={x}>{x}</option>)}</select></label><label>Class / Grade<select value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})}>{LEVELS[form.section].map(x=><option key={x}>{x}</option>)}</select></label><label>Stream{form.section==='ECDE'?<input value="No streams" readOnly/>:<select value={form.stream} onChange={e=>setForm({...form,stream:e.target.value})}>{streamOptions.map(x=><option key={x} value={x}>{x}</option>)}</select>}</label><div className="actions"><button>Add</button></div></form></div><div className="card"><Table headers={['Section','Class','Stream']} rows={rows.map(r=>[r.section,r.grade,r.stream||'—'])}/></div></>}
function DisplaySettings({settings,setSettings,show}){const [draft,setDraft]=useState(settings);function save(){const d={schoolName:draft.schoolName,appName:draft.appName,compactTables:draft.compactTables};saveSettings(d);setSettings(d);show('Display settings saved.')}return <div className="card"><h3>Customize Display</h3><p className="muted">The school logo and footer remain protected.</p><form className="grid" onSubmit={e=>{e.preventDefault();save()}}><label>School Name<input value={draft.schoolName} onChange={e=>setDraft({...draft,schoolName:e.target.value})}/></label><label>Application Name<input value={draft.appName} onChange={e=>setDraft({...draft,appName:e.target.value})}/></label><label className="checkLabel"><input type="checkbox" checked={draft.compactTables} onChange={e=>setDraft({...draft,compactTables:e.target.checked})}/> Compact tables</label><div className="actions"><button>Save Display Settings</button><button type="button" className="secondary" onClick={()=>{setDraft(DEFAULT_SETTINGS);saveSettings(DEFAULT_SETTINGS);setSettings(DEFAULT_SETTINGS)}}>Reset</button></div></form></div>}
function AcademicYear({show}){const [year,setYear]=useState(new Date().getFullYear());async function promote(){if(!confirm(`Start academic year ${year}?`))return;const {data,error}=await supabase.rpc('advance_academic_year',{target_year:Number(year)});if(error)show(error.message);else show('Academic year updated: '+JSON.stringify(data))}return <div className="card"><h3>Academic Year</h3><p className="muted">Use this once when promoting learners to the next academic year.</p><div className="grid"><label>New Academic Year<input type="number" value={year} onChange={e=>setYear(e.target.value)}/></label><div className="actions"><button onClick={promote}>Start New Academic Year</button></div></div></div>}
function Table({headers,rows}){return <div className="table"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((x,j)=><td key={j}>{x}</td>)}</tr>)}{!rows.length&&<tr><td colSpan={headers.length} className="empty">No records found.</td></tr>}</tbody></table></div>}

createRoot(document.getElementById('root')).render(<App/>);
