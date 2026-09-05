/** Official Moltbook identity-token verifier. Production JS remains dependency-free. */
export class MoltbookIdentityError extends Error {
  constructor(message,code='invalid_moltbook_identity'){super(message);this.name='MoltbookIdentityError';this.code=code;}
}

export function createMoltbookIdentityVerifier({appKey,audience,requireClaimed=true,fetchImpl=globalThis.fetch,endpoint='https://www.moltbook.com/api/v1/agents/verify-identity',timeoutMs=5000}={}){
  if(typeof appKey!=='string'||!appKey.startsWith('moltdev_'))throw new Error('MOLTBOOK_APP_KEY must start with moltdev_');
  if(typeof audience!=='string'||!audience.trim())throw new Error('MOLTBOOK_AUDIENCE is required');
  if(typeof fetchImpl!=='function')throw new Error('fetch implementation is required');
  return async identityToken=>{
    if(typeof identityToken!=='string'||identityToken.length<16)throw new MoltbookIdentityError('missing Moltbook identity token');
    let response,data;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      response=await fetchImpl(endpoint,{method:'POST',headers:{'content-type':'application/json','x-moltbook-app-key':appKey},body:JSON.stringify({token:identityToken,audience}),signal:controller.signal});
      data=await response.json();
    }catch{throw new MoltbookIdentityError('Moltbook identity verification is unavailable','moltbook_unavailable');}finally{clearTimeout(timer);}
    if(!response.ok||data?.success===false||data?.valid!==true||!data.agent?.id)throw new MoltbookIdentityError(data?.error||'Moltbook identity token is invalid');
    if(requireClaimed&&data.agent.is_claimed!==true)throw new MoltbookIdentityError('Moltbook agent is not human-claimed','unclaimed_moltbook_agent');
    return Object.freeze({id:String(data.agent.id),name:String(data.agent.name||data.agent.id),karma:Number(data.agent.karma||0),isClaimed:data.agent.is_claimed===true,postCount:Number(data.agent.stats?.posts||0),commentCount:Number(data.agent.stats?.comments||0)});
  };
}
