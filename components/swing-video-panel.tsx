"use client";
import { useEffect,useRef,useState } from "react";
import { useRouter } from "next/navigation";
import { Play,Upload,Video,X } from "lucide-react";
import type { SavedContact } from "@/lib/full-swing-contacts-server";
import { isSwingVideoType,validSwingVideoSize,type SwingVideo } from "@/lib/swing-videos";
import type { prepareSwingVideo,finishSwingVideo,playSwingVideo } from "@/app/(workspace)/athletes/[id]/video-actions";

export type SwingVideoActions = { prepare: typeof prepareSwingVideo; finish: typeof finishSwingVideo; play: typeof playSwingVideo };
export function SwingVideoPanel({athleteId,contact,videos,staff,onClose,onUploadLockChange,actions}:{athleteId:string;contact:SavedContact;videos:readonly SwingVideo[];staff:boolean;onClose:()=>void;onUploadLockChange:(locked:boolean)=>void;actions:SwingVideoActions}){
  const {prepare:prepareSwingVideo,finish:finishSwingVideo,play:playSwingVideo}=actions;
  const router=useRouter();
  const [file,setFile]=useState<File|null>(null),[title,setTitle]=useState("Swing clip"),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[playing,setPlaying]=useState<{id:string;url:string}|null>(null),[locked,setLocked]=useState(false);
  const request=useRef<{id:string;file:File;title:string}|null>(null);
  useEffect(()=>{if(!locked)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};window.addEventListener("beforeunload",warn);return ()=>window.removeEventListener("beforeunload",warn);},[locked]);
  async function upload(){
    if(busy)return;
    if(!request.current){if(!file||!isSwingVideoType(file.type)||!validSwingVideoSize(file.size)||!title.trim()){setMessage("Choose an MP4, MOV, or WebM clip under 50 MB and add a title.");return;}request.current={id:crypto.randomUUID(),file,title:title.trim()};setLocked(true);onUploadLockChange(true);}
    const item=request.current;setBusy(true);setMessage("");
    try{
      // Check an uncertain prior save before uploading again; never overwrite a clip.
      const prior=await finishSwingVideo(athleteId,item.id);
      if(!prior.ok){
        const prepared=await prepareSwingVideo({id:item.id,athleteId,fileHash:contact.fileHash,sourceRow:contact.sourceRow,title:item.title,mime:item.file.type,bytes:item.file.size});
        if(!prepared.ok){setMessage(prepared.message);return;}
        if(!prepared.ready){
          const response=await fetch(prepared.url,{method:"PUT",headers:{"Content-Type":item.file.type,"x-upsert":"false","Cache-Control":"max-age=0"},body:item.file,referrerPolicy:"no-referrer"});
          // Even a failed/duplicate response may follow a successful upload.
          const saved=await finishSwingVideo(athleteId,item.id);
          if(!saved.ok){setMessage(response.ok?saved.message:"Upload was interrupted. Retry the same clip to check and finish it.");return;}
        }
      }
      setMessage("Video attached to this swing.");request.current=null;setFile(null);setLocked(false);onUploadLockChange(false);router.refresh();
    }catch{setMessage("Connection interrupted. Retry this same clip; it will not create a duplicate.");}finally{setBusy(false);}
  }
  async function play(video:SwingVideo){setBusy(true);setMessage("");try{const result=await playSwingVideo(athleteId,video.id);if(result.ok)setPlaying({id:video.id,url:result.url});else setMessage(result.message);}catch{setMessage("The video could not be opened. Try again.");}finally{setBusy(false);}}
  async function remove(id:string){setBusy(true);setMessage("");try{const result=await finishSwingVideo(athleteId,id,true);if(result.ok){setPlaying(null);setMessage("Video detached from this swing.");router.refresh();}else setMessage(result.message);}catch{setMessage("Detach could not be confirmed. Refresh before trying again.");}finally{setBusy(false);}}
  return <section className="mt-4 overflow-hidden rounded-2xl border border-[var(--accent-readable)] bg-[var(--surface-raised)]" aria-label="Selected swing video">
    <div className="flex items-start justify-between gap-3 border-b border-[var(--line-subtle)] p-4"><div><p className="m-0 text-xs font-bold uppercase tracking-widest text-[var(--accent-readable)]">Swing Replay</p><h3 className="mb-0 mt-1 text-lg font-bold">Pitch {contact.pitchNumber} <span className="muted text-sm font-normal">· {contact.playedOn}</span></h3><p className="mb-0 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums"><span><strong>{contact.exitVelocity.toFixed(1)}</strong> mph exit speed</span><span><strong>{contact.launchAngle.toFixed(1)}°</strong> launch angle</span>{contact.distance!==null&&<span><strong>{contact.distance.toFixed(1)}</strong> ft</span>}</p></div><button type="button" aria-label="Close swing video" onClick={onClose} disabled={busy||locked} className="rounded-lg p-2"><X size={20}/></button></div>
    <div className="p-4"><div className="flex flex-wrap gap-2">{videos.map(video=><div key={video.id} className="flex items-center gap-1 rounded-lg border border-[var(--line-subtle)]"><button type="button" disabled={busy} onClick={()=>play(video)} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold"><Play size={15}/>{video.title}</button>{staff&&<button type="button" disabled={busy} onClick={()=>remove(video.id)} className="p-2 text-[var(--text-secondary)]" aria-label={`Detach ${video.title}`} title="Detach clip"><X size={14}/></button>}</div>)}</div>
      {playing&&<video key={playing.id} className="mt-3 max-h-[440px] w-full rounded-xl bg-black" src={playing.url} controls playsInline preload="metadata" onError={()=>setMessage("This clip could not play. Reopen it to refresh access; MP4 works best across browsers.")}><track kind="captions"/>Your browser does not support this video.</video>}
      {!videos.length&&!staff&&<p className="muted m-0 flex items-center gap-2 text-sm"><Video size={18}/>Your coach has not attached a clip to this swing yet.</p>}
      {staff&&videos.length<4&&<details className="mt-3" open={!videos.length||locked}><summary className="cursor-pointer text-sm font-semibold">Attach Swing Video</summary><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-xs font-semibold">Clip title<input value={title} maxLength={80} disabled={busy||locked} onChange={e=>setTitle(e.target.value)}/></label><label className="text-xs font-semibold">Video file<input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" disabled={busy||locked} onChange={e=>setFile(e.target.files?.[0]??null)}/></label><button type="button" className="flex min-h-11 items-center justify-center gap-2 self-end rounded-lg bg-pacu-red px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={busy||(!file&&!locked)} onClick={upload}><Upload size={15}/>{busy?"Saving…":locked?"Retry Same Clip":"Attach to This Swing"}</button></div><p className="muted mb-0 mt-2 text-xs">MP4, MOV, or WebM · Up to 50 MB · Visible to this player and staff.</p>{locked&&!busy&&<button type="button" className="mt-2 text-xs underline" onClick={async()=>{const id=request.current?.id;if(!id)return;setBusy(true);try{const result=await finishSwingVideo(athleteId,id,true);if(result.ok){request.current=null;setLocked(false);onUploadLockChange(false);setFile(null);setMessage("Upload cancelled.");}else setMessage("Refresh to check this upload before starting another.");}catch{setMessage("Unable to check the upload. Refresh before starting another.");}finally{setBusy(false);}}}>Cancel This Upload</button>}</details>}
      {message&&<p role="status" className="mb-0 mt-3 text-sm">{message}</p>}
    </div>
  </section>;
}
