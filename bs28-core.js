/* BS-STYLE RC v28.0 - shared, deterministic race-plan helpers.
   State-changing transactions belong to the authorized Main Control browser. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BS28=api;
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  const ss=i=>'SS'+(Number(i)+1);
  const stageIndex=name=>/^SS([1-9]\d*)$/.test(String(name))?Number(String(name).slice(2))-1:-1;
  const entries=v=>v&&typeof v==='object'?Object.entries(v):[];
  const memberIds=members=>Array.isArray(members)?members.map(String):entries(members).filter(([,v])=>!!v).map(([k])=>String(k));
  const stageNames=(v)=>Object.keys(v?.stages||{}).filter(k=>stageIndex(k)>=0).sort((a,b)=>stageIndex(a)-stageIndex(b));
  const includedStages=v=>stageNames(v).filter(k=>v.stages[k]?.included===true&&v.stages[k]?.cancelled!==true);
  const shuffle=(ids,random)=>{const arr=[...ids].map(String);const rand=random||secureRandom;for(let i=arr.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr};
  function secureRandom(){if(typeof crypto==='undefined'||!crypto.getRandomValues)throw Error('Secure random source unavailable (use HTTPS).');const b=new Uint32Array(1);crypto.getRandomValues(b);return b[0]/4294967296}
  function balancedGroups(ids,n,random){if(!Number.isInteger(n)||n<2||n>4)throw Error('Choose 2 to 4 groups.');const shuffled=shuffle(ids,random),groups={};for(let i=0;i<n;i++)groups[String.fromCharCode(65+i)]=[];shuffled.forEach((id,i)=>groups[String.fromCharCode(65+i%n)].push(id));return groups}
  const statusFor=v=>v?.status==='finish'||v?.status==='dnf'||v?.status==='dns';
  const allResultsConfirmed=(group,event,stage)=>memberIds(group?.members).length>0&&memberIds(group.members).every(id=>statusFor(event?.results?.[id]?.[stageIndex(stage)]));
  const completeForDriver=(plan,driverId,results)=>includedStages(plan).every(s=>statusFor(results?.[driverId]?.[stageIndex(s)]));
  const groupForStage=(plan,stage)=>{const id=plan?.stageOwners?.[stage];return id&&plan.groups?.[id]?{id,group:plan.groups[id]}:null};
  function availability(plan,groupId,stage,locks={}){
    const g=plan?.groups?.[groupId],info=plan?.stages?.[stage],owner=plan?.stageOwners?.[stage];
    if(!g||!info||!info.included||info.cancelled)return 'CANCELLED';
    if(g.completedStages?.[stage])return 'COMPLETED';
    if(!info.open)return 'CLOSED';
    if(owner)return 'BUSY';
    if(locks?.[stage])return 'LOCKED';
    return 'AVAILABLE';
  }
  function canChoose(plan,groupId,stage,locks={}){return plan?.enabled===true&&plan?.groups?.[groupId]?.status==='CHOOSING'&&availability(plan,groupId,stage,locks)==='AVAILABLE'}
  function nextDriver(plan,groupId,stage,event,exclude=''){
    const order=plan?.orders?.[groupId]?.[stage]?.order||[];
    return order.find(id=>String(id)!==String(exclude)&&!statusFor(event?.results?.[id]?.[stageIndex(stage)]))||null;
  }
  const clone=x=>JSON.parse(JSON.stringify(x));
  function makeDraw(plan,groupId,stage,random){const group=plan?.groups?.[groupId];if(!group)throw Error('Unknown group.');const old=plan?.orders?.[groupId]?.[stage];if(old)return clone(old);return {drawId:`${groupId}:${stage}:${group.visitIndex||0}`,order:shuffle(memberIds(group.members),random),createdAt:Date.now()}}
  function reserveForRequest(plan,request,proposedOrder,locks={},now=Date.now()){
    if(!plan?.enabled||!request?.requestId||!request?.groupId||!request?.destination)return null;
    const {groupId,destination,visitIndex,requestId}=request;
    const group=plan.groups?.[groupId];
    if(plan.processedRequests?.[requestId]?.status==='accepted')return clone(plan);
    if(!group||Number(group.visitIndex)!==Number(visitIndex)||!canChoose(plan,groupId,destination,locks))return null;
    const members=memberIds(group.members),incoming=[...proposedOrder].map(String);
    if(incoming.length!==members.length||new Set(incoming).size!==members.length||members.some(id=>!incoming.includes(id)))return null;
    const updated=clone(plan);
    updated.stageOwners=updated.stageOwners||{};
    if(updated.stageOwners[destination])return null;
    updated.stageOwners[destination]=groupId;
    updated.groups[groupId].currentStage=destination;
    updated.groups[groupId].status='READY';
    updated.orders=updated.orders||{};updated.orders[groupId]=updated.orders[groupId]||{};
    if(updated.orders[groupId][destination])return null;
    updated.orders[groupId][destination]={drawId:groupId+':'+destination+':'+visitIndex,order:incoming,createdAt:now};
    updated.processedRequests=updated.processedRequests||{};
    updated.processedRequests[requestId]={status:'accepted',groupId,stage:destination,at:now};
    updated.audit=updated.audit||{};
    updated.audit['assign-'+requestId]={action:'MARSHAL_SELECTED_SS',groupId,stage:destination,requestId,at:now};
    updated.revision=(updated.revision||0)+1;
    return updated;
  }
  function planStatus(plan){return plan?.enabled===true?'RACING':plan?.phase==='SETUP'?'SETUP':'NOT CONFIGURED'}
  function validatePlan(plan){
    if(!plan||!plan.enabled)return [];
    const errors=[],owners=plan.stageOwners||{},groups=plan.groups||{},seen=new Set();
    for(const [st,id] of Object.entries(owners)){
      if(!groups[id])errors.push(`Owner ${id} missing on ${st}`);
      if(groups[id]?.currentStage!==st)errors.push(`Owner ${id} has wrong current stage`);
      if(!plan.stages?.[st]?.included||plan.stages?.[st]?.cancelled)errors.push(`Owned stage ${st} cancelled`);
    }
    for(const [id,g] of Object.entries(groups)){
      if(g.currentStage&&owners[g.currentStage]!==id)errors.push(`Group ${id} has no matching reservation`);
      if(g.currentStage&&!plan.orders?.[id]?.[g.currentStage])errors.push(`Group ${id} has no draw`);
      if(g.type!=='CATCHUP')for(const driver of memberIds(g.members)){if(seen.has(driver))errors.push(`Driver ${driver} belongs to multiple groups`);seen.add(driver)}
    }
    return errors;
  }
  return {ss,stageIndex,memberIds,stageNames,includedStages,shuffle,secureRandom,balancedGroups,statusFor,allResultsConfirmed,completeForDriver,groupForStage,availability,canChoose,nextDriver,makeDraw,reserveForRequest,planStatus,validatePlan};
});
