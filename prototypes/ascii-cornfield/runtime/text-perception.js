/** Deterministic text -> perceptual vector -> concept populations bridge. */
export const TEXT_PERCEPTION_SCHEMA='text-perception/v1';
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const norm=s=>String(s||'').toLowerCase();
const words=s=>norm(s).match(/[a-z0-9']+/g)||[];
const has=(set,arr)=>arr.some(x=>set.has(x));
const countHits=(set,arr)=>arr.reduce((n,x)=>n+(set.has(x)?1:0),0);

const NUMBER_WORDS=Object.freeze({zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,hundred:100});
const LEX=Object.freeze({
  positive:['free','fun','joy','happy','love','bright','play','calm','peace','open','warm','sun'],
  negative:['none','sad','fear','angry','dark','cold','pain','loss','alone','empty'],
  aroused:['fast','loud','wild','intense','storm','fire','run','rush','excited'],
  calm:['calm','quiet','still','soft','gentle','peace','slow'],
  bright:['bright','sun','light','glow','gold','white','clear'],
  dark:['dark','night','shadow','black','dim'],
  warm:['warm','hot','sun','fire','summer','gold'],
  cold:['cold','ice','snow','winter','blue'],
  open:['free','park','field','sky','open','wide','outside','ocean'],
  confined:['room','box','cage','closed','inside','tight'],
  soft:['soft','gentle','round','smooth','cloud','water'],
  hard:['hard','sharp','metal','stone','rigid','angular'],
  motion:['run','fly','swim','move','wind','dance','roll','rush','free'],
  order:['grid','symmetry','ordered','regular','aligned','pattern'],
  chaos:['chaos','random','wild','broken','mess','storm']
});

function explicitQuantity(tokens){
  for(const t of tokens){if(/^\d+$/.test(t))return Number(t);if(Object.hasOwn(NUMBER_WORDS,t))return NUMBER_WORDS[t];}
  return null;
}
function salience(text,token){const n=norm(text);let c=0,i=0;while((i=n.indexOf(token,i))!==-1){c++;i+=token.length;}return clamp(.45+.18*c);}
function conceptPopulation(text,tokens,label,terms){const set=new Set(tokens),hits=countHits(set,terms);return hits?{label,magnitude:clamp(.5+.14*hits),evidence:terms.filter(x=>set.has(x))}:null;}

export function textToPerceptualVector(text){
  if(typeof text!=='string'||!text.trim())throw new TypeError('text must be a non-empty string');
  const tokens=words(text),set=new Set(tokens),len=tokens.length||1;
  const pos=countHits(set,LEX.positive),neg=countHits(set,LEX.negative);
  const up=countHits(set,LEX.aroused),down=countHits(set,LEX.calm);
  const quantity=explicitQuantity(tokens);
  const punctuation=(text.match(/[!?]/g)||[]).length;
  const lexicalDiversity=new Set(tokens).size/len;
  const valence=clamp(.5+(pos-neg)*.1);
  const arousal=clamp(.35+(up-down)*.1+Math.min(.2,punctuation*.04));
  const brightness=clamp(.5+(countHits(set,LEX.bright)-countHits(set,LEX.dark))*.12);
  const warmth=clamp(.5+(countHits(set,LEX.warm)-countHits(set,LEX.cold))*.1);
  const openness=clamp(.5+(countHits(set,LEX.open)-countHits(set,LEX.confined))*.1);
  const softness=clamp(.5+(countHits(set,LEX.soft)-countHits(set,LEX.hard))*.1);
  const motion=clamp(.25+countHits(set,LEX.motion)*.1+arousal*.25);
  const order=clamp(.5+(countHits(set,LEX.order)-countHits(set,LEX.chaos))*.12);
  const complexity=clamp(.2+Math.min(.5,len/40)+lexicalDiversity*.25);
  const continuity=clamp(.62+(order-.5)*.25-(punctuation>2?.08:0));
  const depth=clamp(.45+openness*.35+complexity*.1);
  const saturation=clamp(.42+Math.abs(valence-.5)*.45+arousal*.2);
  const dominance=clamp(.42+(has(set,['i','mine','my','have','own'])?.16:0)+(has(set,['free','power','strong'])?.08:0));
  const repetition=clamp(quantity==null?.2:.28+Math.log1p(quantity)/Math.log(101)*.65);
  const scale=clamp(.45+(quantity!=null?Math.min(.3,Math.log1p(quantity)/18):0)+(openness-.5)*.2);

  const populations=[
    conceptPopulation(text,tokens,'freedom',['free','freedom','open']),
    conceptPopulation(text,tokens,'self-possession',['i','my','mine','have','own']),
    conceptPopulation(text,tokens,'plurality',['many','group','flock','forty','hundred']),
    conceptPopulation(text,tokens,'place',['park','field','garden','room','city','forest']),
    conceptPopulation(text,tokens,'animal-life',['duck','ducks','bird','birds','animal','animals'])
  ].filter(Boolean);
  for(const t of [...new Set(tokens.filter(t=>t.length>3))].slice(0,8)){
    if(!populations.some(p=>p.evidence.includes(t)))populations.push({label:`semantic:${t}`,magnitude:salience(text,t),evidence:[t]});
  }

  const dimensions={valence,arousal,dominance,brightness,warmth,saturation,openness,depth,complexity,order,motion,softness,continuity,repetition,scale};
  const angle1=(Math.atan2(arousal-.5,valence-.5)+Math.PI*2)%(Math.PI*2);
  const radius1=.2+1.8*clamp((Math.abs(valence-.5)+Math.abs(arousal-.5)+saturation)/2);
  const angle2=(Math.atan2(openness-.5,order-.5)+Math.PI*2)%(Math.PI*2);
  const radius2=.2+1.8*clamp((complexity+repetition+motion)/3);
  const input=Float64Array.of(radius1*Math.cos(angle1),radius1*Math.sin(angle1),radius2*Math.cos(angle2),radius2*Math.sin(angle2));
  return Object.freeze({schema:TEXT_PERCEPTION_SCHEMA,text,dimensions:Object.freeze(dimensions),quantity,quantitySalience:quantity==null?0:clamp(.55+Math.log1p(quantity)/Math.log(101)*.4),populations:Object.freeze(populations),input,modalities:Object.freeze([{angleRadians:angle1,radius:radius1},{angleRadians:angle2,radius:radius2}]),encoding:'text/perceptual-and-semantic'});
}
