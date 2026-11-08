/* RC CRAWLER v28.8.1 — Firebase Spark. No Functions or paid service.
 * Rules validate the merged state of each atomic multi-location update.
 * Completion certificates form an immutable chain over the saved driver order.
 */
(function(root,factory){const api=factory(root.BS28||(typeof require==='function'?require('./bs28-core.js'):null));if(typeof module==='object')module.exports=api;root.BS28_COORDINATOR=api;})(typeof window==='undefined'?globalThis:window,function(C){
'use strict';
const clone=v=>JSON.parse(JSON.stringify(v)), inflight=new Map();
const stable=v=>JSON.stringify(v,function(k,x){return x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x;});
const penaltySignature=value=>JSON.stringify(Object.values(value||{}).map(item=>Object.fromEntries(Object.entries(item||{}).sort(([a],[b])=>a.localeCompare(b)))));
const draw=(p,g,s)=>{const d=C.makeDraw(p,g,s);d.count=C.memberIds(p.groups[g].members).length;d.positions=Object.fromEntries(d.order.map((id,i)=>[id,i]));return d;};
function preparePlan(p){p.sparkProtocol=1;for(const [ss,st] of Object.entries(p.stages||{}))st.index=C.stageIndex(ss);for(const [id,g] of Object.entries(p.groups||{})){g.members=Object.fromEntries(C.memberIds(g.members).map(x=>[x,true]));g.memberCount=Object.keys(g.members).length;for(const d of Object.values(p.orders?.[id]||{})){d.count=d.order.length;d.positions=Object.fromEntries(d.order.map((x,i)=>[x,i]));}}return p;}
function catchupReason(p,id,ss,locks={},runs={},recovery={}){
 const t=p?.lateCatchup?.[id]?.[ss],g=p?.groups?.[t?.groupId];
 if(!t)return 'Catch-up ticket does not exist.';
 if(t.status!=='REQUIRED')return 'Catch-up ticket is '+t.status+', not REQUIRED.';
 if(!g||g.type==='CATCHUP'||!C.memberIds(g.members).includes(id))return 'Driver is not a member of the original group.';
 if(p.groups?.['C'+id]?.currentStage||Object.values(p.lateCatchup?.[id]||{}).some(x=>x.status==='IN_PROGRESS'))return 'Driver already has an active catch-up.';
 if(!p.stages?.[ss]?.included||p.stages[ss].cancelled)return ss+' is excluded or cancelled.';
 if(!p.stages[ss].open)return ss+' is CLOSED.';
 if(p.stageOwners?.[ss])return ss+' is OPEN but reserved by Group '+p.stageOwners[ss]+'.';
 if(runs[id]||Object.values(locks).some(x=>x?.driverId===id))return 'Driver is currently running another SS or has an unsaved run.';
 if(locks[ss])return ss+' has an active timer lock.';
 if(recovery[ss])return ss+' has pending recovery that Main Control must review.';
 return '';
}
function context(app,eid){const db=app.database(),base='events/'+eid+'/',plan=base+'groupRotationV28/';return {db,base,plan,read:async path=>(await db.ref(path).get()).val(),update:values=>db.ref().update(values),uid:app.auth().currentUser?.uid};}
async function state(x){const [ev,locks,runs,recovery]=await Promise.all([x.read(x.base),x.read('stageLocks/'+x.eid),x.read('driverRunLocks/'+x.eid),x.read('recoveryPendingByStage/'+x.eid)]);if(!ev?.groupRotationV28?.enabled||ev.groupRotationV28.sparkProtocol!==1)throw Error('This event uses the previous protocol. Use a NEW test Event ID and START RACE with v28.8.1; do not reset completed records.');return {ev,p:ev.groupRotationV28,locks:locks||{},runs:runs||{},recovery:recovery||{}};}
async function release(x,args,unstarted=false){
 const path='stageLocks/'+x.eid+'/'+args.stage,l=await x.read(path);if(!l)return {released:true};
 if(l.runId!==args.runId||l.driverId!==args.driverId)throw Error('A different run holds this stage. Nothing was released.');
 if(unstarted){if(l.authUid!==x.uid||l.started===true)throw Error('Started or foreign run cannot be cancelled.');}
 else {const r=await x.read(x.base+'results/'+l.driverId+'/'+C.stageIndex(args.stage));if(!C.statusFor(r)||r.runId!==l.runId||!r.sparkFinal)throw Error('The exact run has not been saved. Stage remains locked.');}
 const ptr=await x.read('driverRunLocks/'+x.eid+'/'+l.driverId);
 if(ptr?.runId!==l.runId||ptr?.stage!==args.stage)throw Error('Driver reservation differs; organiser review required.');
 const updates={[path]:null,['driverRunLocks/'+x.eid+'/'+l.driverId]:null};
 // Session lock is only a permission hint, never the authoritative driver lock.
 if(l.authUid===x.uid){const session=await x.read('marshalSessions/'+x.eid+'/'+x.uid+'/activeLock');if(session?.runId===l.runId)updates['marshalSessions/'+x.eid+'/'+x.uid+'/activeLock']=null;}
 await x.update(updates);return {released:true};
}
async function reconcile(x){
 let snapshot=await state(x);
 for(const [ss,l] of Object.entries(snapshot.locks)){
  const r=snapshot.ev.results?.[l.driverId]?.[C.stageIndex(ss)];
  if(C.statusFor(r)&&r.runId===l.runId&&r.sparkFinal)try{await release(x,{stage:ss,driverId:l.driverId,runId:l.runId});}catch(e){/* another device may have released it; completion rules still check */}
 }
 snapshot=await state(x);let completed=0;
 for(const [gid,g] of Object.entries(snapshot.p.groups||{})){
  const ss=g.currentStage,d=snapshot.p.orders?.[gid]?.[ss];
  if(!ss||!d||snapshot.locks[ss]||snapshot.recovery[ss]||!C.allResultsConfirmed(g,snapshot.ev,ss))continue;
  const order=d.order;let failed=false;
  for(let i=0;i<order.length;i++){
   const id=String(order[i]),r=snapshot.ev.results?.[id]?.[C.stageIndex(ss)];
   if(!r?.sparkFinal||!r.runId||snapshot.runs[id]){failed=true;break;}
   const cp=x.plan+'confirmations/'+gid+'/'+ss+'/'+i;
   if(await x.read(cp))continue;
   try{await x.db.ref(cp).set({driverId:id,runId:r.runId});}catch(e){if(!await x.read(cp)){failed=true;break;}}
  }
  if(failed)continue;
  const audit={action:'GROUP_COMPLETED_SS',groupId:gid,stage:ss,at:Date.now(),authUid:x.uid};
  const u={[x.plan+'stageOwners/'+ss]:null,[x.plan+'groups/'+gid+'/currentStage']:null,[x.plan+'groups/'+gid+'/lastStage']:ss,[x.plan+'groups/'+gid+'/completedStages/'+ss]:true,[x.plan+'groups/'+gid+'/status']:(g.type==='CATCHUP'||C.includedStages(snapshot.p).every(stage=>stage===ss||g.completedStages?.[stage]))?'FINISHED':'CHOOSING',[x.plan+'groups/'+gid+'/visitIndex']:Number(g.visitIndex||0)+1,[x.plan+'audit/complete-'+gid+'-'+ss]:audit};
  if(g.type==='CATCHUP')u[x.plan+'lateCatchup/'+g.driverId+'/'+ss+'/status']='DONE';
  try{await x.update(u);completed++;}catch(e){const latest=await x.read(x.plan+'groups/'+gid);if(latest?.currentStage===ss)throw Error('Completion was rejected: a result, recovery record or reservation changed. '+e.message);}
 }
 return {completed};
}
async function run(app,eid,action,args){
 const x={...context(app,eid),eid};if(!x.uid)throw Error('Firebase session is not signed in.');
 if(action==='releaseSavedRun')return release(x,args);
 if(action==='releaseUnstarted')return release(x,args,true);
 if(action==='reconcile')return reconcile(x);
 if(action==='scheduleCatchup'){
  const control=await x.read('controlSessions/'+eid);if(!args.controlSessionId||control?.activeSessionId!==args.controlSessionId||control.runActive)throw Error('Main Control does not own the active session, or has an unfinished run.');
  await reconcile(x);const fresh=await state(x);let reason=catchupReason(fresh.p,args.driverId,args.stage,fresh.locks,fresh.runs,fresh.recovery);
  if(reason){if(fresh.p.lateCatchup?.[args.driverId]?.[args.stage]?.status==='IN_PROGRESS'&&fresh.p.groups?.['C'+args.driverId]?.currentStage===args.stage)return {scheduled:true};throw Error(reason);}
  const ref=x.db.ref(x.base);let rejected='Event changed during scheduling.';
  // A listener gives transaction retries a populated cache. Null is never written.
  const listener=()=>{};ref.on('value',listener);try{await ref.get();const tx=await ref.transaction(ev=>{
   if(!ev)return;const v=clone(ev),p=v.groupRotationV28;reason=catchupReason(p,args.driverId,args.stage);if(reason){rejected=reason;return;}
   if(C.statusFor(v.results?.[args.driverId]?.[C.stageIndex(args.stage)])){rejected='A result is already saved for this driver at '+args.stage+'. Review the catch-up ticket in Main Control.';return;}
   const id='C'+args.driverId,old=p.groups[id],t=p.lateCatchup[args.driverId][args.stage];
   p.groups[id]={...(old||{}),id,type:'CATCHUP',driverId:args.driverId,baseGroupId:t.groupId,controlSessionId:args.controlSessionId,members:{[args.driverId]:true},memberCount:1,currentStage:args.stage,status:'READY',visitIndex:Number(old?.visitIndex||0)};
   p.stageOwners=p.stageOwners||{};p.stageOwners[args.stage]=id;p.orders=p.orders||{};p.orders[id]=p.orders[id]||{};p.orders[id][args.stage]=draw(p,id,args.stage);
   t.status='IN_PROGRESS';t.scheduledAt=Date.now();p.audit=p.audit||{};p.audit['catchup-'+args.driverId+'-'+args.stage]={action:'CATCHUP_SCHEDULED',driverId:args.driverId,groupId:id,stage:args.stage,at:Date.now()};p.revision=(p.revision||0)+1;return v;
  },undefined,false);if(!tx.committed)throw Error(rejected);}catch(e){throw Error('Firebase rejected catch-up assignment. A timer/reservation may have changed, or Main Control is not authorised. '+e.message);}finally{ref.off('value',listener);}return {scheduled:true};
 }
 if(action==='selectStage'){
  await reconcile(x);const {p,locks,recovery}=await state(x),g=p.groups?.[args.groupId];
  if(g?.currentStage===args.stage&&p.stageOwners?.[args.stage]===args.groupId)return {selected:true};
  if(!g||g.type==='CATCHUP'||g.currentStage||g.status!=='CHOOSING')throw Error('Group must finish and SAVE every driver before choosing another SS.');
  if(args.memberSignature!==C.memberIds(g.members).sort().join('|'))throw Error('Group membership changed. Review the fresh queue and select again.');
  if(C.availability(p,args.groupId,args.stage,locks)!=='AVAILABLE'||recovery[args.stage])throw Error('SS is closed, reserved, already completed, or has an unfinished run/recovery record.');
  const d=draw(p,args.groupId,args.stage),u={[x.plan+'groups/'+args.groupId+'/currentStage']:args.stage,[x.plan+'groups/'+args.groupId+'/status']:'READY',[x.plan+'stageOwners/'+args.stage]:args.groupId,[x.plan+'orders/'+args.groupId+'/'+args.stage]:d,[x.plan+'audit/select-'+args.groupId+'-'+args.stage]:{action:'MARSHAL_SELECTED_SS',groupId:args.groupId,stage:args.stage,at:Date.now(),authUid:x.uid}};
  await x.update(u);return {selected:true};
 }
 if(action==='acquireRun'){
  const {p,ev,locks,runs,recovery}=await state(x),ss=args.stage,id=args.driverId,gid=p.stageOwners?.[ss],g=p.groups?.[gid],prior=locks[ss];
  if(C.statusFor(ev.results?.[id]?.[C.stageIndex(ss)]))throw Error('This driver already has a saved result at this SS. Corrections belong in Main Control.');
  if(prior?.authUid===x.uid&&prior.driverId===id&&prior.marshalSessionId===args.marshalSessionId)return {lock:prior};
  if(prior)throw Error('SS has an active timer lock.');if(runs[id])throw Error('Driver is currently running another SS.');
  if(p.groups?.['C'+id]?.currentStage&&p.groups['C'+id].currentStage!==ss)throw Error('Driver must finish the active catch-up first. Other group members may continue.');
  if(!g||g.currentStage!==ss||!C.memberIds(g.members).includes(id)||!p.orders?.[gid]?.[ss]?.order.includes(id)||!p.stages[ss].open||p.stages[ss].cancelled||recovery[ss])throw Error('Driver is not assigned to an available OPEN SS, or recovery is pending.');
  if(C.statusFor(ev.results?.[id]?.[C.stageIndex(ss)]))throw Error('This driver already has a saved result at this SS. Corrections belong in Main Control.');
  const l={status:'running',eventId:eid,stage:ss,stageKey:String(C.stageIndex(ss)),groupId:gid,driverId:id,driverName:ev.drivers?.[id]?.name||'',driverNum:ev.drivers?.[id]?.num||'',runId:args.runId,authUid:x.uid,marshalSessionId:args.marshalSessionId,marshalName:args.marshalName,startedAt:Date.now(),started:false};
  await x.update({['stageLocks/'+eid+'/'+ss]:l,['driverRunLocks/'+eid+'/'+id]:{stage:ss,runId:l.runId,authUid:x.uid},['marshalSessions/'+eid+'/'+x.uid+'/activeLock']:{...l,stageName:ss}});return {lock:l};
 }
 if(action==='recordFirstStart'){
  const {p,locks}=await state(x),l=locks[args.stage];if(!l||l.runId!==args.runId||l.authUid!==x.uid)throw Error('This device no longer owns the run.');
  const g=p.groups[l.groupId],u={['stageLocks/'+eid+'/'+args.stage+'/started']:true};
  if(!g.firstStartByStage?.[args.stage]){
   const order=p.orders[l.groupId][args.stage].order,i=Number(g.visitIndex||0);
   u[x.plan+'groups/'+l.groupId+'/firstStartByStage/'+args.stage]=args.driverId;
   u[x.plan+'groups/'+l.groupId+'/firstDriverCounts/'+args.driverId]=Number(g.firstDriverCounts?.[args.driverId]||0)+1;
   u[x.plan+'groups/'+l.groupId+'/firstDriverHistory/'+i]={stage:args.stage,driverId:args.driverId,at:Date.now(),queuePosition:order.indexOf(args.driverId)+1,queueFirstDriverId:order[0]};
  }
  await x.update(u);return {recorded:true};
 }
 throw Error('Unknown race operation.');
}
async function call(app,eid,action,args={}){
 if(typeof navigator!=='undefined'&&navigator.onLine===false)throw Error('Firebase is offline. Reconnect before changing assignments.');
 const key=JSON.stringify([app.auth().currentUser?.uid,eid,action,args]);if(inflight.has(key))return inflight.get(key);
 const promise=run(app,eid,action,args);inflight.set(key,promise);try{return await promise;}finally{inflight.delete(key);}
}
async function writeQueued(app,eid,path,value,expectedRunId){
 const db=app.database(),base='events/'+eid+'/',m=/^results\/([^/]+)\/(\d+)$/.exec(path);
 const pm=/^penalties\/([^/]+)\/(\d+)$/.exec(path);
 if(pm&&expectedRunId){const lockPath='stageLocks/'+eid+'/SS'+(Number(pm[2])+1);return db.ref().update({[base+path]:value,[lockPath+'/penaltyWrite']:{runId:expectedRunId,nonce:Date.now()+'-'+Math.random().toString(36).slice(2)}});}
 if(!m||!value?.sparkFinal)return db.ref(base+path).set(value);
 const existing=(await db.ref(base+path).get()).val();if(existing?.runId===value.runId&&stable(existing)===stable(value))return;
 const updates={[base+path]:value,[base+'penalties/'+m[1]+'/'+m[2]]:JSON.parse(value.penaltySnapshotJson||'[]')};await db.ref().update(updates);
}
return {call,penaltySignature,preparePlan,catchupReason,writeQueued,draw};
});
