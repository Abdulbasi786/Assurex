/* AssureX additive visualizations.
 * Render only from the claims already loaded for this authorized page. No extra
 * database queries, test data, layout resets, or backend changes.
 */
(function(){
  'use strict';
  var NS='http://www.w3.org/2000/svg';
  var palette=['#8099fa','#4dd7cc','#c4a1ee','#e4b46b','#e58b9c','#90a5c5'];
  var root=null, page='';
  function el(tag, cls, txt){var n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;}
  function svgNode(tag, attrs){var n=document.createElementNS(NS,tag);Object.keys(attrs||{}).forEach(function(k){n.setAttribute(k,String(attrs[k]));});return n;}
  function heading(parent,title,subtitle){var h=el('div','ax-project-charts-heading'),left=el('div');left.append(el('small','',subtitle),el('h2','',title));h.append(left);parent.append(h);}
  function card(grid,title,subtitle,wide){var c=el('article','ax-project-chart-card'+(wide?' ax-wide':''));c.append(el('h3','',title),el('p','ax-chart-subtitle',subtitle));grid.append(c);return c;}
  function empty(c,message){c.append(el('div','ax-chart-empty',message));}
  function dateOf(value){if(!value)return null;var d=null;
    try{if(typeof value.toDate==='function')d=value.toDate();else if(typeof value.toMillis==='function')d=new Date(value.toMillis());else if(value.seconds!==undefined)d=new Date(Number(value.seconds)*1000);else d=new Date(value);}catch(e){}
    return d instanceof Date&&!isNaN(d.getTime())?d:null;
  }
  function summaryStatus(c){var s=String(c.status||c.claimStatus||c.validationStatus||'').trim().toLowerCase().replace(/[_-]+/g,' ');
    if(['approved','validated','valid','accepted','covered'].includes(s))return 'Approved / Valid';
    if(['rejected','invalid','declined','denied'].includes(s))return 'Rejected / Invalid';
    if(['pending','pending review','manual review','review','under evaluation','in review','under review','needs review'].includes(s))return 'Awaiting review';
    return 'Other / Unrecorded';
  }
  function countBy(rows,value){var map=new Map();rows.forEach(function(c){var k=String(value(c)||'Not recorded').trim()||'Not recorded';map.set(k,(map.get(k)||0)+1);});return [...map].sort(function(a,b){return b[1]-a[1];});}
  function rowsChart(c, data){if(!data.length){empty(c,'No stored records available for this chart.');return;}
    var max=Math.max.apply(null,data.map(function(x){return x[1];}))||1, list=el('div','ax-chart-list');
    data.forEach(function(pair){var row=el('div','ax-chart-row'),label=el('span','',pair[0]),track=el('div','ax-chart-track'),fill=el('i'),n=el('strong','',String(pair[1]));
      label.title=pair[0];fill.style.width=(pair[1]/max*100)+'%';track.setAttribute('role','img');track.setAttribute('aria-label',pair[0]+': '+pair[1]);track.append(fill);row.append(label,track,n);list.append(row);
    });c.append(list);
  }
  function donut(c, data){if(!data.length){empty(c,'No claims to visualize yet.');return;}
    var total=data.reduce(function(a,r){return a+r[1];},0);if(!total){empty(c,'No claims to visualize yet.');return;}
    var wrap=el('div','ax-chart-donut-wrap'),s=svgNode('svg',{viewBox:'0 0 140 140',role:'img','aria-label':'Claim status distribution across '+total+' claims',class:'ax-chart-donut'}),circ=2*Math.PI*51,offset=0;
    s.append(svgNode('circle',{cx:70,cy:70,r:51,fill:'none',stroke:'rgba(125,151,196,.18)','stroke-width':17}));
    data.forEach(function(item,i){var part=item[1]/total*circ;var n=svgNode('circle',{cx:70,cy:70,r:51,fill:'none',stroke:palette[i%palette.length],'stroke-width':17,'stroke-dasharray':part+' '+(circ-part),'stroke-dashoffset':-offset});
      var t=svgNode('title');t.textContent=item[0]+': '+item[1];n.append(t);s.append(n);offset+=part;});
    var legend=el('div','ax-chart-legend');data.forEach(function(pair,i){var row=el('div','ax-chart-legend-row'),sw=el('i'),name=el('span','',pair[0]),n=el('strong','',pair[1]+' ('+Math.round(pair[1]/total*100)+'%)');sw.style.background=palette[i%palette.length];row.append(sw,name,n);legend.append(row);});wrap.append(s,legend);c.append(wrap);
  }
  function monthChart(c,claims){var dated=claims.map(function(r){return dateOf(r.createdAt||r.submittedAt||r.submissionDate);}).filter(Boolean);
    if(!dated.length){empty(c,'No recorded claim dates yet.');return;}
    var now=new Date(),months=[];for(var i=5;i>=0;i--){var d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push({key:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),label:d.toLocaleString(undefined,{month:'short'}),count:0});}
    dated.forEach(function(d){var key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');months.forEach(function(m){if(m.key===key)m.count++;});});
    var W=520,H=168,L=22,R=18,T=20,B=36,max=Math.max(1,...months.map(function(x){return x.count;})),space=(W-L-R)/5;
    var s=svgNode('svg',{viewBox:'0 0 '+W+' '+H,class:'ax-chart-trend',role:'img','aria-label':'Claim submissions per month for six calendar months'});
    for(var g=0;g<=3;g++){var y=T+(H-T-B)*g/3;s.append(svgNode('line',{x1:L,x2:W-R,y1:y,y2:y,class:'ax-gridline'}));var v=svgNode('text',{x:2,y:y+4});v.textContent=Math.round(max*(1-g/3));s.append(v);}
    var coords=months.map(function(m,i){return [L+i*space,T+(H-T-B)*(1-m.count/max)];});var p=svgNode('polyline',{points:coords.map(function(a){return a.join(',');}).join(' '),class:'ax-line'});s.append(p);
    months.forEach(function(m,i){var xy=coords[i],dot=svgNode('circle',{cx:xy[0],cy:xy[1],r:4.5,class:'ax-point'}),title=svgNode('title');title.textContent=m.key+': '+m.count+' claims';dot.append(title);s.append(dot);var label=svgNode('text',{x:xy[0],y:H-10,'text-anchor':'middle'});label.textContent=m.label;s.append(label);});c.append(s);
  }
  function decisions(c,claims){var recorded=claims.filter(function(x){return !!(x.finalDecision||x.reviewDecision||x.predictedDecision||x.predictionLabel);});
    rowsChart(c,countBy(recorded,function(x){return x.finalDecision||x.reviewDecision||x.predictedDecision||x.predictionLabel;}).slice(0,6));}
  function risks(c,claims){var recorded=claims.filter(function(x){return x.riskLevel||x.risk||x.evaluation&&x.evaluation.risk;});
    rowsChart(c,countBy(recorded,function(x){return x.riskLevel||x.risk||x.evaluation&&x.evaluation.risk;}).slice(0,6));}
  function mount(){var host=document.querySelector('main.dashboard-content > section.page[data-page="dashboard"]')||document.querySelector('main.dashboard-content > section.page[data-page="analytics"]');
    if(!host||document.getElementById('axProjectCharts'))return;
    page=host.dataset.page;root=el('section','ax-project-charts');root.id='axProjectCharts';root.setAttribute('aria-label','Claim data visualizations');
    heading(root,page==='dashboard'?'Claim insights':'Additional claim insights','Visualizations from accessible Firestore records only');var grid=el('div','ax-project-chart-grid');root.append(grid);
    if(page==='dashboard'){
      card(grid,'Claim status mix','Stored statuses · no estimated values');card(grid,'Submission trend','Last six calendar months');card(grid,'Most frequent damage categories','Based on submitted claim fields',true);
      var anchor=host.querySelector('.dashboard-grid');if(anchor)anchor.after(root);else host.append(root);
      window.addEventListener('assurex-dashboard-claims-loaded',function(e){render(e.detail&&e.detail.claims||[]);});
    }else{
      card(grid,'Recorded claim decisions','Python/reviewer decision fields, where present');card(grid,'Recorded risk levels','Only records with a saved risk field');host.append(root);
      window.addEventListener('assurex-claims-loaded',function(){render(window.AssureXClaims||[]);});
      if(Array.isArray(window.AssureXClaims))render(window.AssureXClaims);
    }
  }
  function render(claims){if(!root)return;var cards=root.querySelectorAll('.ax-project-chart-card');cards.forEach(function(c){while(c.children.length>2)c.lastElementChild.remove();});
    if(page==='dashboard'){
      donut(cards[0],countBy(claims,summaryStatus));monthChart(cards[1],claims);
      rowsChart(cards[2],countBy(claims,function(x){return x.damageCategory||x.faultType||x.damage||x.wizardData&&x.wizardData.faultType||'Not recorded';}).slice(0,5));
    }else{decisions(cards[0],claims);risks(cards[1],claims);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
