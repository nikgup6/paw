import { useEffect, useState } from 'react';

/* The little dog at the bottom of "Choose Your Journey", with a speech bubble above it.

   The bubble changes line every LINE_MS so it reads as the dog talking to you while you
   decide. Pure decoration around real copy: nothing here is clickable, and it never moves
   the two journey cards above it.

   HOW TO EDIT
   - the lines ........ LINES below, in order
   - how long each one stays ... LINE_MS (2s)
   - the picture ...... public/assets/journey-dog.png (swap the file, keep the name) */

const LINES = [
  'Find your life partner. It’s not who you think.',
  'He’s cute. But can he handle your Monday?',
  'Don’t marry the first fluffy face you see.',
  'Love at first sight is cute. Compatibility lasts 14 years.',
];

const LINE_MS = 2000;
const DOG_SRC = '/assets/journey-dog.png';

export default function JourneyDog() {
  const [i, setI] = useState(0);
  // read once at mount rather than in an effect: it never changes mid-session here,
  // and setting state from an effect body just costs an extra render
  const [reduced] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  });

  useEffect(() => {
    if (LINES.length < 2) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % LINES.length), LINE_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="pbjd">
      <style>{CSS}</style>
      {/* key = the index, so each line mounts fresh and plays the entrance */}
      <p className={`pbjd__bubble${reduced ? ' is-still' : ''}`} key={i}>
        {LINES[i]}
      </p>
      <span className="pbjd__dog">
        <img src={DOG_SRC} alt="" width="241" height="243" loading="lazy" decoding="async" draggable={false} />
      </span>
    </div>
  );
}

const CSS = `
.pbjd{display:flex;flex-direction:column;align-items:center;margin:26px 0 2px;padding:0 4px}

.pbjd__bubble{
  position:relative;
  box-sizing:border-box;
  max-width:330px;
  margin:0 0 12px;
  padding:11px 16px 12px;
  background:#011E4A;
  color:#FFFFFF;
  border-radius:16px;
  font:600 13.5px 'Satoshi','Inter',sans-serif;
  line-height:1.45;
  text-align:center;
  box-shadow:0 8px 22px rgba(1,30,74,.18);
  animation:pbjd-in .34s cubic-bezier(.2,1,.3,1) both;
}
/* the tail, pointing down at the dog */
.pbjd__bubble::after{
  content:'';
  position:absolute;left:50%;bottom:-6px;
  width:13px;height:13px;margin-left:-6.5px;
  background:#011E4A;
  transform:rotate(45deg);
  border-radius:2px;
}
@keyframes pbjd-in{from{opacity:0;transform:translateY(6px) scale(.97)}to{opacity:1;transform:none}}
.pbjd__bubble.is-still{animation:none}

/* A rounded square, not a circle: the picture is a face with praying paws at the bottom,
   and a circle crop cut the paws clean off - which is the whole joke. */
.pbjd__dog{
  width:96px;height:96px;
  border-radius:22px;
  overflow:hidden;
  border:3px solid #FFFFFF;
  box-shadow:0 0 0 3px #FFD9BD,0 8px 20px rgba(1,30,74,.18);
  background:#FFF1E6;
  flex:none;
}
.pbjd__dog img{width:100%;height:100%;object-fit:cover;display:block;user-select:none}


/* Phones: a touch smaller, and the bubble takes the width it is given. */
@media (max-width:600px){
  .pbjd{margin-top:22px}
  .pbjd__bubble{max-width:100%;font-size:13px;padding:10px 14px 11px}
  .pbjd__dog{width:84px;height:84px;border-radius:19px}
}

@media (prefers-reduced-motion:reduce){.pbjd__bubble{animation:none}}
`;
