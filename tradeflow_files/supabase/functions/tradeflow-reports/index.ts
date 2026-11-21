/** TradeFlow weekly reports. PRIVATE Supabase Storage, PIN-session gated server API. */
import { createClient } from 'npm:@supabase/supabase-js@2'

const BUCKET = 'tradeflow-weekly-reports'
const MAX_FILE = 12 * 1024 * 1024
const MAX_THUMB = 300 * 1024
const MIME = new Set(['image/jpeg','image/png','application/pdf'])
const cors = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Access-Control-Allow-Headers':'apikey,content-type,x-tradeflow-token,authorization',
  'Cache-Control':'no-store',
  'Vary':'Origin'
}
function json(data: Record<string, unknown>, status=200) { return new Response(JSON.stringify(data),{status,headers:{...cors,'content-type':'application/json; charset=utf-8'}}) }
function dateOK(x: unknown): x is string {
  if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false
  const dt=new Date(x+'T00:00:00Z');return Number.isFinite(dt.getTime())&&dt.toISOString().slice(0,10)===x
}
/**
 * Compute a Monday–Friday period from an authoritative server timestamp.
 * Convert the instant to London calendar parts first, then use UTC calendar
 * arithmetic so DST transitions never shift the reporting dates.
 */
function londonTradingWeek(at: Date): {week_start:string,week_end:string} {
  const parts=new Intl.DateTimeFormat('en-GB', {
    timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(at)
  const pick=(type:string)=>Number(parts.find(p=>p.type===type)?.value)
  const year=pick('year'),month=pick('month'),day=pick('day')
  if(!year||!month||!day)throw new Error('Could not calculate London report date')
  const calendar=new Date(Date.UTC(year,month-1,day))
  const daysSinceMonday=(calendar.getUTCDay()+6)%7
  calendar.setUTCDate(calendar.getUTCDate()-daysSinceMonday)
  const week_start=calendar.toISOString().slice(0,10)
  calendar.setUTCDate(calendar.getUTCDate()+4)
  return {week_start,week_end:calendar.toISOString().slice(0,10)}
}
function uuidOK(x: unknown):x is string {return typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x)}
function infoOK(body: Record<string, unknown>) {
  const start=body.start,end=body.end,title=body.title,notes=body.notes
  if(!dateOK(start)||!dateOK(end)||start>end)throw new Error('Invalid report date range')
  if(typeof title!=='string'||title.length>180||typeof notes!=='string'||notes.length>2000)throw new Error('Invalid report title or notes')
  return {week_start:start,week_end:end,title:title.trim(),notes:notes.trim()}
}
function sniff(bytes: Uint8Array) {
  if(bytes.length>=8&&bytes.slice(0,8).every((v,i)=>v===[137,80,78,71,13,10,26,10][i]))return 'image/png'
  if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg'
  if(bytes.length>=5&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-')return 'application/pdf'
  return null
}
const filename=(s:string)=>s.replace(/[\\/\x00-\x1f\x7f]/g,'_').slice(0,180)||'report'

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors})
  if(req.method!=='POST')return json({ok:false,error:'Method not allowed'},405)
  const url=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||Deno.env.get('TRADEFLOW_SUPABASE_SECRET_KEY')
  if(!url||!secret)return json({ok:false,error:'Reports backend is not configured'},503)
  const token=req.headers.get('x-tradeflow-token')||''
  if(token.length<32||token.length>256)return json({ok:false,error:'Invalid or expired session'},401)
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}})
  try{
    // Server-side validation against the EXISTING temporary PIN session table.
    const {data:valid,error:authError}=await db.rpc('tradeflow_session_valid',{p_token:token})
    if(authError) return json({ok:false,error:'Session validation unavailable. Apply the reports SQL migration.'},503)
    if(valid!==true)return json({ok:false,error:'Invalid or expired session'},401)
    const contentType=req.headers.get('content-type')||''
    let action:string, body:Record<string,unknown>={};let form:FormData|null=null
    if(contentType.includes('multipart/form-data')){
      const reportedSize=Number(req.headers.get('content-length')||0)
      if(reportedSize>MAX_FILE+MAX_THUMB+150000)return json({ok:false,error:'Upload exceeds allowed size'},413)
      form=await req.formData();action=String(form.get('action')||'')
      body={title:form.get('title'),notes:form.get('notes'),upload_id:form.get('upload_id')}
    }else if(contentType.includes('application/json')){
      body=await req.json();action=String(body?.action||'')
    }else return json({ok:false,error:'Unsupported request format'},415)
    if(action==='list'){
      const {data,error}=await db.from('tradeflow_weekly_reports').select('id,week_start,week_end,title,notes,original_name,mime_type,file_size,thumbnail_path,created_at,updated_at').order('week_start',{ascending:false}).order('created_at',{ascending:false}).limit(1000)
      if(error)throw new Error('Cannot list reports; verify migration and storage configuration')
      const reports=await Promise.all((data||[]).map(async r=>{
        let thumbnail_url:string|null=null
        if(r.thumbnail_path){const signed=await db.storage.from(BUCKET).createSignedUrl(r.thumbnail_path,600);thumbnail_url=signed.error?null:signed.data.signedUrl}
        const {thumbnail_path:discard,...safe}=r
        return {...safe,thumbnail_url}
      }))
      return json({ok:true,reports})
    }
    if(action==='upload'){
      if(!form)return json({ok:false,error:'Multipart upload required'},400)
      // Upload dates are server-owned: ignore any client-supplied start/end values.
      const acceptedAt=new Date()
      const period=londonTradingWeek(acceptedAt)
      const metadata=infoOK({...body,start:period.week_start,end:period.week_end}),file=form.get('file'),thumbnail=form.get('thumbnail')
      if(!uuidOK(body.upload_id))return json({ok:false,error:'Invalid upload identifier'},400)
      const id=body.upload_id
      const existing=await db.from('tradeflow_weekly_reports').select('id').eq('id',id).maybeSingle()
      if(existing.error)throw new Error('Could not verify previous upload')
      if(existing.data)return json({ok:true,id,already_uploaded:true})
      if(!(file instanceof File)||file.size<5||file.size>MAX_FILE)return json({ok:false,error:'Invalid file size (maximum 12 MB)'},400)
      if(!MIME.has(file.type))return json({ok:false,error:'PNG, JPEG or PDF required'},400)
      const bytes=new Uint8Array(await file.arrayBuffer()),kind=sniff(bytes)
      if(kind!==file.type)return json({ok:false,error:'File content does not match its type'},400)
      const extension=kind==='image/png'?'png':kind==='image/jpeg'?'jpg':'pdf',path=`${id}/original.${extension}`
      let thumbPath:string|null=null;let thumbBytes:Uint8Array|null=null
      if(thumbnail instanceof File&&kind!=='application/pdf'){
        if(thumbnail.size>MAX_THUMB)return json({ok:false,error:'Thumbnail too large'},400)
        thumbBytes=new Uint8Array(await thumbnail.arrayBuffer())
        if(sniff(thumbBytes)!=='image/jpeg')return json({ok:false,error:'Invalid thumbnail'},400)
        thumbPath=`${id}/thumbnail.jpg`
      }
      const put=await db.storage.from(BUCKET).upload(path,bytes,{contentType:kind,upsert:false,cacheControl:'3600'})
      if(put.error)throw new Error('File upload failed; check private storage bucket')
      try{
        if(thumbPath&&thumbBytes){const up=await db.storage.from(BUCKET).upload(thumbPath,thumbBytes,{contentType:'image/jpeg',upsert:false,cacheControl:'3600'});if(up.error)throw new Error('Thumbnail upload failed')}
        const {error}=await db.from('tradeflow_weekly_reports').insert({id,...metadata,original_name:filename(file.name),mime_type:kind,file_size:file.size,storage_path:path,thumbnail_path:thumbPath,created_at:acceptedAt.toISOString()})
        if(error)throw new Error('Report metadata could not be saved')
      }catch(e){await db.storage.from(BUCKET).remove([path,...(thumbPath?[thumbPath]:[])]);throw e}
      return json({ok:true,id},201)
    }
    const id=body.id
    if(!uuidOK(id))return json({ok:false,error:'Invalid report identifier'},400)
    const {data:r,error:readError}=await db.from('tradeflow_weekly_reports').select('*').eq('id',id).maybeSingle()
    if(readError)throw new Error('Could not load report')
    if(!r)return json({ok:false,error:'Report not found'},404)
    if(action==='open'){
      const {data,error}=await db.storage.from(BUCKET).createSignedUrl(r.storage_path,300,{download:body.download===true?filename(r.original_name):undefined})
      if(error)throw new Error('Could not generate private report URL')
      return json({ok:true,url:data.signedUrl})
    }
    if(action==='update'){
      const metadata=infoOK(body)
      const {error}=await db.from('tradeflow_weekly_reports').update({...metadata,updated_at:new Date().toISOString()}).eq('id',id)
      if(error)throw new Error('Could not update report')
      return json({ok:true})
    }
    if(action==='delete'){
      const paths=[r.storage_path,...(r.thumbnail_path?[r.thumbnail_path]:[])]
      const removed=await db.storage.from(BUCKET).remove(paths)
      if(removed.error)throw new Error('Could not remove stored report; metadata kept for retry')
      const {error}=await db.from('tradeflow_weekly_reports').delete().eq('id',id)
      if(error)throw new Error('Stored file removed but metadata cleanup failed. Retry delete or contact administrator.')
      return json({ok:true})
    }
    return json({ok:false,error:'Unknown action'},400)
  }catch(e){
    const msg=e instanceof Error?e.message:'Unexpected reports error'
    const validation=/^Invalid report|^PNG,|^File content|^Thumbnail|^Unsupported/.test(msg)
    return json({ok:false,error:msg},validation?400:500)
  }
})
