/** Private CRT reference image API; requires the existing TradeFlow PIN-session token. */
import {createClient} from 'npm:@supabase/supabase-js@2'
const BUCKET='tradeflow-crt-images',MAX=8*1024*1024
const allowed=new Set(['4h','1h','15m'])
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'apikey,content-type,x-tradeflow-token,authorization','Cache-Control':'no-store','Vary':'Origin'}
const reply=(obj:Record<string,unknown>,status=200)=>new Response(JSON.stringify(obj),{status,headers:{...cors,'content-type':'application/json; charset=utf-8'}})
const uuid=(x:unknown)=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x)
const safeName=(x:string)=>x.replace(/[\\/\x00-\x1f\x7f]/g,'_').slice(0,150)||'chart'
function sniff(b:Uint8Array){if(b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))return'image/png';if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return'image/jpeg';if(b.length>=12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')return'image/webp';return null}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});if(req.method!=='POST')return reply({ok:false,error:'Method not allowed'},405)
 const url=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||Deno.env.get('TRADEFLOW_SUPABASE_SECRET_KEY');if(!url||!secret)return reply({ok:false,error:'CRT image backend not configured'},503)
 const token=req.headers.get('x-tradeflow-token')||'';if(token.length<32||token.length>256)return reply({ok:false,error:'Invalid or expired session'},401)
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}})
 try{
  const {data:valid,error:authError}=await db.rpc('tradeflow_session_valid',{p_token:token});if(authError)return reply({ok:false,error:'PIN session validation unavailable'},503);if(valid!==true)return reply({ok:false,error:'Invalid or expired session'},401)
  const type=req.headers.get('content-type')||'';let body:Record<string,unknown>,form:FormData|null=null
  if(type.includes('multipart/form-data')){const n=Number(req.headers.get('content-length')||0);if(n>MAX+120000)return reply({ok:false,error:'Image too large (8 MB maximum)'},413);form=await req.formData();body={action:form.get('action'),model:form.get('model')}}
  else if(type.includes('application/json')){const parsed=await req.json();if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return reply({ok:false,error:'Invalid request'},400);body=parsed}
  else return reply({ok:false,error:'Unsupported content type'},415)
  const action=body.action,model=body.model;if(typeof model!=='string'||!allowed.has(model))return reply({ok:false,error:'Invalid CRT model'},400)
  if(action==='list'){
   const {data,error}=await db.from('tradeflow_crt_images').select('id,model,original_name,mime_type,file_size,storage_path,created_at').eq('model',model).order('created_at',{ascending:false}).limit(150)
   if(error)throw Error('Could not load CRT images; apply the new SQL section')
   const images=await Promise.all((data||[]).map(async x=>{const signed=await db.storage.from(BUCKET).createSignedUrl(x.storage_path,600);return{id:x.id,model:x.model,original_name:x.original_name,mime_type:x.mime_type,file_size:x.file_size,created_at:x.created_at,url:signed.error?'':signed.data.signedUrl}}))
   return reply({ok:true,images})
  }
  if(action==='upload'){
   if(!form)return reply({ok:false,error:'Multipart image upload required'},400)
   const file=form.get('file');if(!(file instanceof File)||file.size<12||file.size>MAX)return reply({ok:false,error:'Image size must be 12 bytes to 8 MB'},400)
   if(!['image/png','image/jpeg','image/webp'].includes(file.type))return reply({ok:false,error:'PNG, JPEG or WebP required'},400)
   const bytes=new Uint8Array(await file.arrayBuffer());const mime=sniff(bytes);if(!mime||mime!==file.type)return reply({ok:false,error:'Image signature does not match the image format'},400)
   const id=crypto.randomUUID(),ext=mime==='image/png'?'png':mime==='image/jpeg'?'jpg':'webp',path=`${model}/${id}.${ext}`
   const put=await db.storage.from(BUCKET).upload(path,bytes,{contentType:mime,cacheControl:'3600',upsert:false});if(put.error)throw Error('Private image storage upload failed')
   const {error}=await db.from('tradeflow_crt_images').insert({id,model,original_name:safeName(file.name),mime_type:mime,file_size:file.size,storage_path:path})
   if(error){await db.storage.from(BUCKET).remove([path]);throw Error('Image metadata save failed')}
   return reply({ok:true,id},201)
  }
  if(action!=='open'&&action!=='delete')return reply({ok:false,error:'Unknown action'},400)
  if(!uuid(body.id))return reply({ok:false,error:'Invalid image identifier'},400)
  const {data:row,error:lookupErr}=await db.from('tradeflow_crt_images').select('id,model,storage_path,original_name').eq('id',body.id).eq('model',model).maybeSingle()
  if(lookupErr)throw Error('Could not load image');if(!row)return reply({ok:false,error:'Image not found in this model'},404)
  if(action==='open'){const {data,error}=await db.storage.from(BUCKET).createSignedUrl(row.storage_path,300);if(error)throw Error('Could not open private image');return reply({ok:true,url:data.signedUrl})}
  const removed=await db.storage.from(BUCKET).remove([row.storage_path]);if(removed.error)throw Error('Could not remove private image; database record retained')
  const {error}=await db.from('tradeflow_crt_images').delete().eq('id',row.id).eq('model',model);if(error)throw Error('Storage removed, but metadata cleanup failed')
  return reply({ok:true})
 }catch(err){return reply({ok:false,error:err instanceof Error?err.message:'Unexpected image error'},500)}
})
