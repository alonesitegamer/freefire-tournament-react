// File: src/components/AvatarSelector.jsx
import React, { useMemo } from "react";

// Avatar selector modal/grid
// Props:
// - open (bool)
// - onClose()
// - profile { level, avatar }
// - onSave(avatarFilename) => should persist to firestore (provided by parent)

const AVATARS = [
  "angelic.jpg","authentic.jpg","brain.jpg","chicken.jpg","crown.jpg","cyberpunk.jpg","default.jpg","dragon.jpg","flame-falco.jpg","flower-wind.jpg","flower.jpg","free.jpg","freefire.jpg","ghost-mask.jpg","ghost.jpg","girl.jpg","helm.jpg","panda.jpg","pink-glow.jpg","purple.jpg","radiation.jpg","season7.jpg","season8.jpg","season9.jpg","star.jpg","unknown.jpg","water.jpg"
];

export default function AvatarSelector({ open, onClose, profile, onSave }) {
  const userLevel = profile?.level || 1;

  // Simple level lock rule: earlier avatars are easier to unlock.
  // You can replace this mapping with any explicit rules.
  const avatarMeta = useMemo(() => {
    return AVATARS.map((file, i) => {
      // example rule: avatars at later indexes require higher level
      const minLevel = Math.max(1, Math.floor(i / 2) + 1); // 1,1,2,2,3,3,...
      return { file, url: `/avatars/${file}`, minLevel };
    });
  }, []);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e)=>e.stopPropagation()} style={{maxWidth:800}}>
        <h3 className="modern-title">Choose Avatar</h3>
        <p className="modern-subtitle">Tap any avatar to select. Some avatars require higher level.</p>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(96px,1fr))',gap:12,marginTop:12}}>
          {avatarMeta.map(a => {
            const locked = userLevel < a.minLevel;
            const isCurrent = (profile?.avatar || 'default.jpg') === a.file;
            return (
              <button
                key={a.file}
                className="reward-card"
                style={{padding:6,position:'relative',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}
                onClick={() => { if (!locked) onSave(a.file); }}
                title={locked ? `Requires level ${a.minLevel}` : (isCurrent ? 'Current avatar' : 'Select')}
                aria-disabled={locked}
              >
                <img src={a.url} alt={a.file} style={{width:72,height:72,objectFit:'cover',borderRadius:10,border:isCurrent? '2px solid var(--accent3)': '1px solid rgba(255,255,255,0.04)'}}/>
                <div style={{fontSize:12,marginTop:8,color:locked? 'var(--muted)': '#fff'}}>
                  {locked ? `Lv ${a.minLevel}` : (isCurrent ? 'Selected' : '')}
                </div>
                {locked && (
                  <div style={{position:'absolute',left:6,top:6,padding:'4px 6px',background:'rgba(0,0,0,0.5)',borderRadius:8,fontSize:11,color:'var(--muted)'}}>Locked</div>
                )}
              </button>
            );
          })}
        </div>

        <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:16}}>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
