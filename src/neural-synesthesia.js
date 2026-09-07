/**
 * Dependency-free reconstruction of the recurrent Infomax rate network used in
 * Shriki, Sadeh & Ward (2016), PLOS Computational Biology 12(7):e1004959.
 *
 * This module implements the equations in the paper. It does not claim to be
 * the authors' unavailable MATLAB source. Choices that the article does not
 * specify (Euler step, stopping tolerance, random seed, and near-zero jitter)
 * are explicit options and are documented in docs/shriki-2016-reconstruction.md.
 */

export const NEURAL_SYNAESTHESIA_SCHEMA = 'neural-synaesthesia/shriki-2016/v1';
export const PAPER_DOI = '10.1371/journal.pcbi.1004959';

/**
 * Executable choices needed by this project but not numerically reported in
 * the target paper. They are defaults, not claims about the authors' MATLAB.
 */
export const PROJECT_NUMERICAL_DEFAULTS = Object.freeze({
  integrationMethod:'synchronous-explicit-euler',integrationStep:0.5,
  tolerance:1e-9,stableIterations:2,maxIterations:50000,
  pivotTolerance:1e-13,derivativeFloor:0
});

export const PAPER_FIGURE_7_SCENARIOS = Object.freeze({
  balancedLowPlasticity: Object.freeze({meanRadii:[0.2,0.2],learningRate:6e-5,reported:'no-synaesthesia'}),
  deprivedLowPlasticity: Object.freeze({meanRadii:[0.2,2],learningRate:1e-4,reported:'no-synaesthesia'}),
  balancedHighInput: Object.freeze({meanRadii:[2,2],learningRate:1.5e-4,reported:'no-synaesthesia'}),
  balancedHighPlasticity: Object.freeze({meanRadii:[0.2,0.2],learningRate:1e-4,reported:'bidirectional'}),
  deprivedHighPlasticity: Object.freeze({meanRadii:[0.2,2],learningRate:1.5e-4,reported:'modality-2-to-1'})
});

const TWO_PI = Math.PI * 2;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const finite = (x) => typeof x === 'number' && Number.isFinite(x);
const rounded = (x, digits=12) => Number(x.toFixed(digits));

export class NeuralModelError extends Error {
  constructor(message, code='neural_model_error') { super(message); this.name='NeuralModelError'; this.code=code; }
}

/** Logistic function used by both cited 2016 papers. */
export function logistic(x) {
  if (x >= 0) { const z=Math.exp(-x); return 1/(1+z); }
  const z=Math.exp(x); return z/(1+z);
}

/** First and second derivatives, evaluated from s = logistic(h). */
export const logisticPrimeFromOutput = s => s*(1-s);
export const logisticSecondFromOutput = s => s*(1-s)*(1-2*s);

class GaussianRandom {
  constructor(seed=1) { this.state=(seed>>>0)||1; this.spare=null; }
  uniform() { let x=this.state; x^=x<<13; x^=x>>>17; x^=x<<5; this.state=x>>>0; return this.state/4294967296; }
  normal() {
    if(this.spare!==null){const value=this.spare;this.spare=null;return value;}
    let u=0,v=0;while(u<=Number.EPSILON)u=this.uniform();while(v<=Number.EPSILON)v=this.uniform();
    const mag=Math.sqrt(-2*Math.log(u)),angle=TWO_PI*v;this.spare=mag*Math.sin(angle);return mag*Math.cos(angle);
  }
}

const assertMatrix = (data, rows, cols, name) => {
  if(!Number.isInteger(rows)||rows<1||!Number.isInteger(cols)||cols<1)throw new NeuralModelError(`${name} dimensions are invalid`,'invalid_matrix');
  if(!data||data.length!==rows*cols||[...data].some(x=>!finite(Number(x))))throw new NeuralModelError(`${name} must contain ${rows*cols} finite values`,'invalid_matrix');
};

const transpose = (a, rows, cols) => {
  const out=new Float64Array(a.length);
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++)out[j*rows+i]=a[i*cols+j];
  return out;
};

const multiply = (a, aRows, inner, b, bCols) => {
  const out=new Float64Array(aRows*bCols);
  for(let i=0;i<aRows;i++)for(let k=0;k<inner;k++){
    const av=a[i*inner+k];if(av===0)continue;
    for(let j=0;j<bCols;j++)out[i*bCols+j]+=av*b[k*bCols+j];
  }
  return out;
};

const matrixVector = (a, rows, cols, vector) => {
  const out=new Float64Array(rows);
  for(let i=0;i<rows;i++){let sum=0;for(let j=0;j<cols;j++)sum+=a[i*cols+j]*vector[j];out[i]=sum;}
  return out;
};

/** Partial-pivoted Gauss-Jordan inverse. Sizes in the paper top out at 142. */
export function invertSquareMatrix(input, n, pivotTolerance=1e-13) {
  assertMatrix(input,n,n,'matrix');
  const width=n*2,aug=new Float64Array(n*width);
  for(let i=0;i<n;i++){for(let j=0;j<n;j++)aug[i*width+j]=Number(input[i*n+j]);aug[i*width+n+i]=1;}
  for(let col=0;col<n;col++){
    let pivot=col,pivotAbs=Math.abs(aug[col*width+col]);
    for(let row=col+1;row<n;row++){const value=Math.abs(aug[row*width+col]);if(value>pivotAbs){pivot=row;pivotAbs=value;}}
    if(!(pivotAbs>pivotTolerance))throw new NeuralModelError('matrix is singular or ill-conditioned','singular_matrix');
    if(pivot!==col)for(let j=0;j<width;j++){const a=col*width+j,b=pivot*width+j,t=aug[a];aug[a]=aug[b];aug[b]=t;}
    const divisor=aug[col*width+col];for(let j=0;j<width;j++)aug[col*width+j]/=divisor;
    for(let row=0;row<n;row++)if(row!==col){const factor=aug[row*width+col];if(factor===0)continue;for(let j=0;j<width;j++)aug[row*width+j]-=factor*aug[col*width+j];}
  }
  const out=new Float64Array(n*n);for(let i=0;i<n;i++)for(let j=0;j<n;j++)out[i*n+j]=aug[i*width+n+j];return out;
}

function positiveLogDet(a,n,tolerance=1e-14){
  const lower=new Float64Array(n*n);let sumLogs=0;
  for(let i=0;i<n;i++)for(let j=0;j<=i;j++){
    let value=a[i*n+j];for(let k=0;k<j;k++)value-=lower[i*n+k]*lower[j*n+k];
    if(i===j){if(!(value>tolerance))throw new NeuralModelError('susceptibility Gram matrix is not positive definite','singular_susceptibility');lower[i*n+j]=Math.sqrt(value);sumLogs+=Math.log(lower[i*n+j]);}
    else lower[i*n+j]=value/lower[j*n+j];
  }
  return 2*sumLogs;
}

const matrixMaxAbs = a => {let out=0;for(const x of a)out=Math.max(out,Math.abs(x));return out;};

/**
 * Circular population vector. The publication-defined value is the complex
 * sum. `normalization: 'mean'` preserves the former project visualization
 * convention, which changes magnitude by 1/M but not phase.
 */
export function populationVector(activity, preferredAngles,{normalization='sum'}={}) {
  if(!activity||activity.length<1||activity.length!==preferredAngles?.length)throw new NeuralModelError('activity and preferredAngles must have equal non-zero lengths','invalid_population');
  if(!['sum','mean'].includes(normalization))throw new NeuralModelError("population normalization must be 'sum' or 'mean'",'invalid_population');
  let real=0,imaginary=0;
  for(let i=0;i<activity.length;i++){real+=activity[i]*Math.cos(preferredAngles[i]);imaginary+=activity[i]*Math.sin(preferredAngles[i]);}
  if(normalization==='mean'){real/=activity.length;imaginary/=activity.length;}
  const angleRadians=(Math.atan2(imaginary,real)+TWO_PI)%TWO_PI;
  return Object.freeze({real,imaginary,magnitude:Math.hypot(real,imaginary),angleRadians,angleDegrees:angleRadians*180/Math.PI,normalization});
}

/**
 * Stability calculation from S1 Appendix. Inputs are output variances in
 * [0, .25], not Gaussian input variances. At K=0 E[s_i]=.5, so the appendix's
 * alpha_i^2 is variance + .25.
 */
export function simpleNoCrossTalkStability({variance1,variance2,learningRate=1e-4}){
  if(!finite(variance1)||!finite(variance2)||variance1<0||variance1>0.25||variance2<0||variance2>0.25)throw new NeuralModelError('output variances must lie in [0, 0.25]','invalid_variance');
  if(!finite(learningRate)||learningRate<0)throw new NeuralModelError('learningRate must be non-negative','invalid_learning_rate');
  const a1=variance1+0.25,a2=variance2+0.25,a1sq=a1*a1,a2sq=a2*a2;
  const trace=4*a1*a2-a1-a2;
  const determinant=-9/16+3*a1+3*a2-4*a1sq-4*a2sq-(29/2)*a1*a2+18*a1*a2sq+18*a1sq*a2-21*a1sq*a2sq;
  const discriminant=trace*trace-4*determinant;
  let eigenvalues,spectralRadius,criticalLearningRate=null;
  if(discriminant>=0){const root=Math.sqrt(discriminant);eigenvalues=[(trace+root)/2,(trace-root)/2];spectralRadius=Math.max(...eigenvalues.map(x=>Math.abs(1+learningRate*x)));if(eigenvalues.every(x=>x<0))criticalLearningRate=Math.min(...eigenvalues.map(x=>-2/x));}
  else{const magnitude=Math.sqrt(Math.max(0,1+learningRate*trace+learningRate*learningRate*determinant));eigenvalues=[{real:trace/2,imaginary:Math.sqrt(-discriminant)/2},{real:trace/2,imaginary:-Math.sqrt(-discriminant)/2}];spectralRadius=magnitude;if(trace<0&&determinant>0)criticalLearningRate=-trace/determinant;}
  const infinitesimalStable=trace<0&&determinant>0;
  return Object.freeze({variance1,variance2,secondMoments:[a1,a2],trace,determinant,discriminant,eigenvalues,criticalLearningRate,spectralRadius,stable:infinitesimalStable&&learningRate>0&&spectralRadius<1});
}

export class InfomaxRecurrentNetwork {
  constructor({inputSize,outputSize,W,K,modalities=[],metadata={}}){
    assertMatrix(W,outputSize,inputSize,'W');assertMatrix(K,outputSize,outputSize,'K');
    this.inputSize=inputSize;this.outputSize=outputSize;this.W=Float64Array.from(W);this.K=Float64Array.from(K);this.modalities=modalities.map(x=>Object.freeze({...x,preferredAngles:Object.freeze([...(x.preferredAngles||[])])}));this.metadata=Object.freeze({...metadata});
  }

  clone(){return new InfomaxRecurrentNetwork({inputSize:this.inputSize,outputSize:this.outputSize,W:this.W,K:this.K,modalities:this.modalities,metadata:this.metadata});}

  /** Numerically integrate tau ds/dt = -s + logistic(Wx + Ks). */
  settle(input,{initialState=null,integrationStep=0.5,tolerance=1e-9,stableIterations=2,maxIterations=50000,allowUnconverged=false}={}){
    if(!input||input.length!==this.inputSize||[...input].some(x=>!finite(Number(x))))throw new NeuralModelError(`input must contain ${this.inputSize} finite values`,'invalid_input');
    if(!finite(integrationStep)||integrationStep<=0||integrationStep>1)throw new NeuralModelError('integrationStep must lie in (0, 1]','invalid_integrator');
    const state=initialState===null?new Float64Array(this.outputSize).fill(0.5):Float64Array.from(initialState);
    if(state.length!==this.outputSize||[...state].some(x=>!finite(x)))throw new NeuralModelError(`initialState must contain ${this.outputSize} finite values`,'invalid_state');
    const direct=matrixVector(this.W,this.outputSize,this.inputSize,input),field=new Float64Array(this.outputSize);let stable=0,maxDelta=Infinity,iterations=0;
    for(iterations=1;iterations<=maxIterations;iterations++){
      maxDelta=0;
      for(let i=0;i<this.outputSize;i++){
        let h=direct[i];for(let j=0;j<this.outputSize;j++)h+=this.K[i*this.outputSize+j]*state[j];field[i]=h;
      }
      for(let i=0;i<this.outputSize;i++){const next=state[i]+integrationStep*(logistic(field[i])-state[i]);maxDelta=Math.max(maxDelta,Math.abs(next-state[i]));state[i]=next;}
      if(maxDelta<tolerance){stable++;if(stable>=stableIterations)break;}else stable=0;
    }
    const converged=iterations<=maxIterations;
    for(let i=0;i<this.outputSize;i++){let h=direct[i];for(let j=0;j<this.outputSize;j++)h+=this.K[i*this.outputSize+j]*state[j];field[i]=h;}
    let fixedPointResidual=0;for(let i=0;i<this.outputSize;i++)fixedPointResidual=Math.max(fixedPointResidual,Math.abs(state[i]-logistic(field[i])));
    if(!converged&&!allowUnconverged)throw new NeuralModelError(`network did not settle in ${maxIterations} iterations`,'did_not_converge');
    return Object.freeze({state,field,iterations:Math.min(iterations,maxIterations),maxDelta,fixedPointResidual,converged});
  }

  /** Fast inference path: settle the rate dynamics without matrix inversions. */
  respond(input,{populationNormalization='sum',...settleOptions}={}){
    const equilibrium=this.settle(input,settleOptions);
    const modalities=this.modalities.map((modality,index)=>{
      const activity=this.modalityActivity(equilibrium.state,index);
      return Object.freeze({name:modality.name,activity,population:populationVector(activity,modality.preferredAngles,{normalization:populationNormalization}),preferredAngles:modality.preferredAngles});
    });
    return Object.freeze({...equilibrium,input:Float64Array.from(input),modalities:Object.freeze(modalities)});
  }

  /** Evaluate Eq. 3 and (optionally) the exact recurrent update direction Eq. 5. */
  analyze(input,{gradient=true,derivativeFloor=0,pivotTolerance=1e-13,...settleOptions}={}){
    if(!finite(derivativeFloor)||derivativeFloor<0)throw new NeuralModelError('derivativeFloor must be non-negative','invalid_analysis');
    if(!finite(pivotTolerance)||pivotTolerance<=0)throw new NeuralModelError('pivotTolerance must be positive','invalid_analysis');
    const equilibrium=this.settle(input,settleOptions),m=this.outputSize,n=this.inputSize,s=equilibrium.state;
    const first=new Float64Array(m),second=new Float64Array(m),operator=new Float64Array(m*m);
    for(let i=0;i<m;i++){
      first[i]=Math.max(derivativeFloor,logisticPrimeFromOutput(s[i]));second[i]=logisticSecondFromOutput(s[i]);
      for(let j=0;j<m;j++)operator[i*m+j]=-this.K[i*m+j];operator[i*m+i]=1/first[i]-this.K[i*m+i];
    }
    const phi=invertSquareMatrix(operator,m,pivotTolerance),chi=multiply(phi,m,m,this.W,n),chiT=transpose(chi,m,n),gram=multiply(chiT,n,m,chi,n);
    const objective=-0.5*positiveLogDet(gram,n,pivotTolerance);
    const result={...equilibrium,input:Float64Array.from(input),firstDerivative:first,secondDerivative:second,phi,susceptibility:chi,gram,objective};
    if(!gradient)return Object.freeze(result);
    const gramInverse=invertSquareMatrix(gram,n,pivotTolerance),chiTPhi=multiply(chiT,n,m,phi,m),gamma=multiply(gramInverse,n,n,chiTPhi,m),chiGamma=multiply(chi,m,n,gamma,m);
    const a=new Float64Array(m);
    for(let i=0;i<m;i++)a[i]=chiGamma[i*m+i]*second[i]/(first[i]*first[i]*first[i]);
    const phiT=transpose(phi,m,m),phiTa=matrixVector(phiT,m,m,a),updateDirection=new Float64Array(m*m);
    for(let i=0;i<m;i++)for(let j=0;j<m;j++)updateDirection[i*m+j]=chiGamma[j*m+i]+phiTa[i]*s[j];
    return Object.freeze({...result,gamma,chiGamma,a,updateDirection});
  }

  objective(input,options={}){return this.analyze(input,{...options,gradient:false}).objective;}

  /** Apply a precomputed descent direction; diagonal exclusion is model-specific. */
  applyUpdate(updateDirection,learningRate,{zeroDiagonal=this.metadata.excludeSelfCoupling===true,maxAbsWeight=Infinity}={}){
    assertMatrix(updateDirection,this.outputSize,this.outputSize,'updateDirection');
    if(!finite(learningRate)||learningRate<0)throw new NeuralModelError('learningRate must be non-negative','invalid_learning_rate');
    if(typeof zeroDiagonal!=='boolean')throw new NeuralModelError('zeroDiagonal must be boolean','invalid_update');
    for(let i=0;i<this.K.length;i++)this.K[i]=clamp(this.K[i]+learningRate*updateDirection[i],-maxAbsWeight,maxAbsWeight);
    if(zeroDiagonal)for(let i=0;i<this.outputSize;i++)this.K[i*this.outputSize+i]=0;
    return this;
  }

  /**
   * Deterministic synchronous training. A publication-compatible best
   * checkpoint compares every saved K on one fixed input ensemble. The old
   * changing-sample comparison survives only behind `legacyOnlineCheckpoint`.
   */
  train({sampler,steps=1,batchSize=1,learningRate=1e-4,policy='fixed-best',restoreBest=true,checkpointInputs=null,checkpointInterval=1,legacyOnlineCheckpoint=false,gradientClip=Infinity,maxAbsWeight=Infinity,zeroDiagonal=this.metadata.excludeSelfCoupling===true,settle={},onStep=null}={}){
    if(typeof sampler!=='function')throw new NeuralModelError('sampler must be a function returning an input vector','invalid_sampler');
    if(!Number.isInteger(steps)||steps<1||!Number.isInteger(batchSize)||batchSize<1)throw new NeuralModelError('steps and batchSize must be positive integers','invalid_training');
    if(!['fixed-best','backtrack'].includes(policy))throw new NeuralModelError('policy must be fixed-best or backtrack','invalid_training');
    if(typeof zeroDiagonal!=='boolean')throw new NeuralModelError('zeroDiagonal must be boolean','invalid_training');
    if(!Number.isInteger(checkpointInterval)||checkpointInterval<1)throw new NeuralModelError('checkpointInterval must be a positive integer','invalid_training');
    if(typeof legacyOnlineCheckpoint!=='boolean')throw new NeuralModelError('legacyOnlineCheckpoint must be boolean','invalid_training');
    const fixedCheckpointInputs=checkpointInputs===null?null:Array.from(checkpointInputs,input=>Float64Array.from(input));
    if(fixedCheckpointInputs?.some(input=>input.length!==this.inputSize||[...input].some(x=>!finite(x))))throw new NeuralModelError('checkpointInputs must contain valid fixed inputs','invalid_training');
    if(restoreBest&&!legacyOnlineCheckpoint&&(!fixedCheckpointInputs||fixedCheckpointInputs.length===0))throw new NeuralModelError('restoreBest requires a non-empty fixed checkpointInputs ensemble; use legacyOnlineCheckpoint only for old visualization runs','missing_checkpoint_ensemble');
    const evaluateCheckpoint=()=>fixedCheckpointInputs.reduce((sum,input)=>sum+this.objective(input,settle),0)/fixedCheckpointInputs.length;
    let eta=learningRate,bestObjective=null,bestK=this.K.slice();const history=[];
    if(restoreBest&&!legacyOnlineCheckpoint){bestObjective=evaluateCheckpoint();bestK=this.K.slice();}
    for(let step=0;step<steps;step++){
      const inputs=[],direction=new Float64Array(this.K.length);let objective=0,settleIterations=0;
      for(let sample=0;sample<batchSize;sample++){
        const input=Float64Array.from(sampler(step,sample));inputs.push(input);const analysis=this.analyze(input,{...settle,gradient:true});objective+=analysis.objective;settleIterations+=analysis.iterations;
        for(let i=0;i<direction.length;i++)direction[i]+=analysis.updateDirection[i]/batchSize;
      }
      objective/=batchSize;
      if(restoreBest&&legacyOnlineCheckpoint&&(bestObjective===null||objective<bestObjective)){bestObjective=objective;bestK=this.K.slice();}
      if(Number.isFinite(gradientClip)){const scale=Math.max(1,matrixMaxAbs(direction)/gradientClip);for(let i=0;i<direction.length;i++)direction[i]/=scale;}
      if(policy==='backtrack'){
        const original=this.K.slice();let accepted=false,attempts=0;
        while(!accepted&&attempts<24){this.K.set(original);this.applyUpdate(direction,eta,{zeroDiagonal,maxAbsWeight});let proposed=0;try{for(const input of inputs)proposed+=this.objective(input,settle)/batchSize;accepted=proposed<=objective;}catch{accepted=false;}if(!accepted)eta/=2;attempts++;}
        if(!accepted)this.K.set(original);
      }else this.applyUpdate(direction,eta,{zeroDiagonal,maxAbsWeight});
      let checkpointObjective=null;
      if(restoreBest&&!legacyOnlineCheckpoint&&((step+1)%checkpointInterval===0||step===steps-1)){
        checkpointObjective=evaluateCheckpoint();if(checkpointObjective<bestObjective){bestObjective=checkpointObjective;bestK=this.K.slice();}
      }
      const record=Object.freeze({step:step+1,objective,checkpointObjective,learningRate:eta,meanSettleIterations:settleIterations/batchSize,maxAbsUpdate:matrixMaxAbs(direction),maxAbsWeight:matrixMaxAbs(this.K)});history.push(record);if(onStep)onStep(record,this);
    }
    if(restoreBest)this.K.set(bestK);
    return Object.freeze({policy,steps,batchSize,initialLearningRate:learningRate,finalLearningRate:eta,bestObjective,checkpointMode:restoreBest?(legacyOnlineCheckpoint?'legacy-changing-sample':'fixed-ensemble'):'disabled',checkpointInputCount:fixedCheckpointInputs?.length??0,checkpointInterval,history:Object.freeze(history),restoredBest:restoreBest,zeroDiagonal});
  }

  modalityActivity(state,index){const modality=this.modalities[index];if(!modality)throw new NeuralModelError(`unknown modality ${index}`,'invalid_modality');return Float64Array.from(state.slice(modality.outputOffset,modality.outputOffset+modality.outputCount));}

  modalityPopulation(state,index,{normalization='sum'}={}){const modality=this.modalities[index];return populationVector(this.modalityActivity(state,index),modality.preferredAngles,{normalization});}

  crossTalkSummary(){
    if(this.modalities.length!==2)return null;const [a,b]=this.modalities;
    const meanBlock=(target,source)=>{let absolute=0,signed=0,count=0;for(let i=0;i<target.outputCount;i++)for(let j=0;j<source.outputCount;j++){const value=this.K[(target.outputOffset+i)*this.outputSize+source.outputOffset+j];absolute+=Math.abs(value);signed+=value;count++;}return {meanAbsolute:absolute/count,meanSigned:signed/count};};
    return Object.freeze({from1To2:meanBlock(b,a),from2To1:meanBlock(a,b)});
  }

  toJSON(){return {schema:NEURAL_SYNAESTHESIA_SCHEMA,paper:{doi:PAPER_DOI},inputSize:this.inputSize,outputSize:this.outputSize,W:Array.from(this.W,x=>rounded(x)),K:Array.from(this.K,x=>rounded(x)),modalities:this.modalities.map(x=>({...x,preferredAngles:[...x.preferredAngles]})),metadata:this.metadata};}
  static fromJSON(value){if(value?.schema!==NEURAL_SYNAESTHESIA_SCHEMA)throw new NeuralModelError(`expected ${NEURAL_SYNAESTHESIA_SCHEMA}`,'invalid_schema');return new InfomaxRecurrentNetwork(value);}
}

export function createSimplePaperNetwork({weights=[1,1],crossTalk=[0,0]}={}){
  if(!Array.isArray(weights)||weights.length!==2||!Array.isArray(crossTalk)||crossTalk.length!==2)throw new NeuralModelError('simple model needs two weights and two cross-talk values','invalid_model');
  return new InfomaxRecurrentNetwork({inputSize:2,outputSize:2,W:[weights[0],0,0,weights[1]],K:[0,crossTalk[0],crossTalk[1],0],modalities:[{name:'modality-1',inputOffset:0,inputCount:1,outputOffset:0,outputCount:1,preferredAngles:[0]},{name:'modality-2',inputOffset:1,inputCount:1,outputOffset:1,outputCount:1,preferredAngles:[0]}],metadata:{model:'paper-simple-model',excludeSelfCoupling:true,selfCouplingProvenance:'S1 Appendix explicitly sets the two diagonal entries to zero'}});
}

/** Published high-dimensional architecture: default N=4, M=142. */
export function createTwoModalityPaperNetwork({neuronsPerModality=71,seed=1,initialRecurrentScale=0,excludeSelfCoupling=false}={}){
  if(!Number.isInteger(neuronsPerModality)||neuronsPerModality<3)throw new NeuralModelError('neuronsPerModality must be an integer of at least 3','invalid_model');
  if(!finite(initialRecurrentScale)||initialRecurrentScale<0)throw new NeuralModelError('initialRecurrentScale must be non-negative','invalid_model');
  if(typeof excludeSelfCoupling!=='boolean')throw new NeuralModelError('excludeSelfCoupling must be boolean','invalid_model');
  const n=4,m=neuronsPerModality*2,W=new Float64Array(m*n),K=new Float64Array(m*m),modalities=[];
  for(let modality=0;modality<2;modality++){
    const preferredAngles=[];
    for(let i=0;i<neuronsPerModality;i++){
      const angle=i*TWO_PI/neuronsPerModality,row=modality*neuronsPerModality+i;preferredAngles.push(angle);W[row*n+modality*2]=Math.cos(angle);W[row*n+modality*2+1]=Math.sin(angle);
    }
    modalities.push({name:`modality-${modality+1}`,inputOffset:modality*2,inputCount:2,outputOffset:modality*neuronsPerModality,outputCount:neuronsPerModality,preferredAngles});
  }
  if(initialRecurrentScale>0){const random=new GaussianRandom(seed);for(let i=0;i<m;i++)for(let j=0;j<m;j++)if(!excludeSelfCoupling||i!==j)K[i*m+j]=(random.uniform()*2-1)*initialRecurrentScale;}
  const initialization=initialRecurrentScale===0?'exact-zero-reconstruction-condition':'seeded-uniform-near-zero-reconstruction-condition';
  return new InfomaxRecurrentNetwork({inputSize:n,outputSize:m,W,K,modalities,metadata:{model:'paper-high-dimensional-model',neuronsPerModality,feedforward:'unit-vectors-at-equal-angles',activation:'logistic',timeUnits:'t/tau',seed,initialRecurrentScale,initialization,initializationProvenance:'target paper says cross-talk near-zero but does not report scale or distribution',excludeSelfCoupling,selfCouplingProvenance:excludeSelfCoupling?'optional project constraint borrowed from the simple S1 model':'general published M x M equation; high-dimensional diagonal policy is not separately reported'}});
}

/** Independent polar inputs with r ~ Normal(mean, radiusSdFraction * mean). */
export function createPaperInputSampler({meanRadii=[0.2,2],radiusSdFraction=0.1,seed=1,randomState=null}={}){
  if(!Array.isArray(meanRadii)||meanRadii.length!==2||meanRadii.some(x=>!finite(x)||x<0))throw new NeuralModelError('meanRadii must contain two non-negative values','invalid_sampler');
  if(!finite(radiusSdFraction)||radiusSdFraction<0)throw new NeuralModelError('radiusSdFraction must be non-negative','invalid_sampler');
  const random=new GaussianRandom(seed);
  if(randomState!==null){if(!Number.isInteger(randomState.state)||randomState.state<0||randomState.state>0xffffffff||(randomState.spare!==null&&!finite(randomState.spare)))throw new NeuralModelError('randomState is invalid','invalid_sampler');random.state=(randomState.state>>>0)||1;random.spare=randomState.spare;}
  const sampler=()=>{const out=new Float64Array(4);for(let modality=0;modality<2;modality++){const angle=TWO_PI*random.uniform(),radius=meanRadii[modality]+meanRadii[modality]*radiusSdFraction*random.normal();out[modality*2]=radius*Math.cos(angle);out[modality*2+1]=radius*Math.sin(angle);}return out;};
  sampler.snapshot=()=>Object.freeze({state:random.state,spare:random.spare});return sampler;
}

/** Construct one direct or cross-modal probe input at a chosen feature angle. */
export function polarProbe({modality=0,angleRadians=0,radius=1}={}){
  if(![0,1].includes(modality)||!finite(angleRadians)||!finite(radius))throw new NeuralModelError('invalid polar probe','invalid_input');
  const input=new Float64Array(4);input[modality*2]=radius*Math.cos(angleRadians);input[modality*2+1]=radius*Math.sin(angleRadians);return input;
}
