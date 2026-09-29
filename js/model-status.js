/* Read model outputs without inferring validity from confidence or reviewer decisions. */
(function(w){'use strict';
function at(o,path){return path.split('.').reduce((v,k)=>v==null?undefined:v[k],o)}
function result(claim,type){
 const names=type==='python'?['pythonModel','python','pythonResult','pythonPrediction']:['teachableMachine','teachable_machine','teachableMachineResult','teachableMachinePrediction'];
 const roots=['aiAnalysis','aiEvaluation','analysis','modelResults','evaluation',''];
 for(const root of roots)for(const name of names){const value=at(claim||{},root?root+'.'+name:name);if(value!==undefined&&value!==null&&value!=='')return typeof value==='object'?value:typeof value==='boolean'?{valid:value}:typeof value==='number'?{confidence:value}:{label:value};}
 return null;
}
function status(r){
 if(!r)return 'Not evaluated';
 for(const key of ['valid','isValid','is_valid'])if(typeof r[key]==='boolean')return r[key]?'Valid':'Not Valid';
 const raw=r.label??r.decision??r.result??r.className??r.prediction??r.status;
 const label=String(raw??'').trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
 if(['invalid','not valid','likely invalid','reject','rejected','declined','denied','not covered','false'].includes(label))return 'Not Valid';
 if(['valid','likely valid','approve','approved','accepted','covered','true'].includes(label))return 'Valid';
 return raw==null?'Not evaluated':'Needs review';
}
function describe(r){const label=status(r);const raw=r&&(r.confidence??r.score??r.probability??r.confidenceScore);const n=raw==null?NaN:Number(raw);return label+(Number.isFinite(n)&&n>=0&&n<=100?' · '+Math.round(n<=1?n*100:n)+'%':'');}
w.AssureXModelStatus={result,status,describe};
})(window);
