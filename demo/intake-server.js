import { ThoughtIntakeService, createThoughtIntakeServer } from '../src/thought-gateway.js';
import { readFileSync } from 'node:fs';
import { createMoltbookIdentityVerifier } from '../src/moltbook-identity.js';
import { loadServerConfig } from '../src/server-config.js';
import { InfomaxRecurrentNetwork } from '../src/neural-synesthesia.js';
import { projectShapeThroughNetwork } from '../src/neural-shape-bridge.js';

try{process.loadEnvFile?.('.env');}catch(error){if(error.code!=='ENOENT'){console.error(`Environment file error: ${error.message}`);process.exit(1);}}
let config;try{config=loadServerConfig();}catch(error){console.error(`Configuration error: ${error.message}`);process.exit(1);}
const identityVerifier=config.authMode==='moltbook'?createMoltbookIdentityVerifier(config.moltbook):null;
let shapeProjector=null;
if(config.visualizer==='neural'){
  try{
    const source=config.neuralCheckpointPath||new URL('../assets/neural-preview-checkpoint.json',import.meta.url),checkpoint=JSON.parse(readFileSync(source,'utf8')),network=InfomaxRecurrentNetwork.fromJSON(checkpoint.network||checkpoint);
    shapeProjector=(shape,record)=>projectShapeThroughNetwork(shape,network,{sequence:record.sequence,perception:record.submission?.perception||null,stimulus:{inducerModality:config.neuralInducerModality},response:{integrationStep:.5,tolerance:1e-8},projection:{maxWeavePaths:12}});
  }catch(error){console.error(`Neural checkpoint error: ${error.message}`);process.exit(1);}
}
const service=new ThoughtIntakeService({agents:config.agents,identityVerifier,receiptSecret:config.receiptSecret,ledgerPath:config.ledgerPath,resourcePolicy:config.resourcePolicy,shapeProjector,sensory:config.sensory});
const browserHtml=readFileSync(new URL('./intake-browser.html',import.meta.url),'utf8');
const server=createThoughtIntakeServer(service,{browserHtml});
server.listen(config.port,config.host,()=>{const address=server.address(),port=typeof address==='object'&&address?address.port:config.port;console.log(`Thought Intake Gateway (${config.authMode} auth, ${config.visualizer} visualization) listening on http://${config.host}:${port}`);});
const shutdown=signal=>{console.log(`${signal}: closing Thought Intake Gateway`);server.close(error=>process.exit(error?1:0));setTimeout(()=>process.exit(1),5000).unref();};
process.once('SIGINT',()=>shutdown('SIGINT'));process.once('SIGTERM',()=>shutdown('SIGTERM'));
