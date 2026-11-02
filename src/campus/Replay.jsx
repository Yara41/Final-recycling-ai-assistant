import React from 'react';
import { Pause, Play, X } from 'lucide-react';

const DURATION = 20000;
const TEXT = {
  ar: {
    title: 'أسبوعك',
    close: 'إغلاق',
    pause: 'إيقاف مؤقت',
    play: 'تشغيل',
    empty: 'لا يوجد نشاط هذا الأسبوع بعد',
    items: (n) => `${n} غرض`,
    correct: (p) => `${p}% فرز صحيح`,
    sub: 'كل نقطة على الحرم عملية تدوير حقيقية خلال آخر 7 أيام.',
    legend: { good: 'موثّق بصورة', wrong: 'حاوية خطأ', self: 'بدون صورة' },
  },
  en: {
    title: 'Your week',
    close: 'Close',
    pause: 'Pause',
    play: 'Play',
    empty: 'No activity this week yet',
    items: (n) => `${n} items`,
    correct: (p) => `${p}% correctly sorted`,
    sub: 'Every dot on the campus is a real recycling action from the last 7 days.',
    legend: { good: 'photo-verified', wrong: 'wrong bin', self: 'no photo' },
  },
};

// Plays the campus's last 7 days in 20 seconds: each event lights up its bin, with the day shown.
export default function Replay({ frames, events = [], lang = 'ar', onFrame, onClose }) {
  const t = TEXT[lang === 'en' ? 'en' : 'ar'];
  const [day, setDay] = React.useState(null);
  const [progress, setProgress] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const pausedRef = React.useRef(false);

  React.useEffect(() => {
    if (!frames.length) return undefined;
    let raf = 0;
    let last = null;
    let elapsed = 0;
    let next = 0;
    const tick = (now) => {
      if (last !== null && !pausedRef.current) elapsed += now - last;
      last = now;
      let latest = null;
      while (next < frames.length && frames[next].atMs <= elapsed) {
        latest = frames[next];
        onFrame?.(frames[next]);
        next += 1;
      }
      if (latest) setDay(latest.at);
      setProgress(Math.min(1, elapsed / DURATION));
      if (elapsed >= DURATION) {
        setDone(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frames, onFrame]);

  const toggle = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };

  const total = events.reduce((n, e) => n + (Number(e.quantity) || 1), 0);
  const right = events.filter((e) => e.correct_bin).reduce((n, e) => n + (Number(e.quantity) || 1), 0);
  const pct = total ? Math.round((right / total) * 100) : 0;
  const dayLabel = day
    ? new Date(day).toLocaleDateString(lang === 'en' ? 'en-US' : 'ar', { weekday: 'long', day: 'numeric', month: 'short' })
    : '';

  return (
    <div className="replay" role="dialog" aria-label={t.title}>
      <div className="replay-head">
        <strong>{t.title}</strong>
        {frames.length > 0 && !done && (
          <button type="button" className="replay-btn" onClick={toggle} aria-label={paused ? t.play : t.pause}>
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
        )}
        <button type="button" className="replay-btn" onClick={onClose} aria-label={t.close}><X size={16} /></button>
      </div>
      {frames.length === 0 ? (
        <p className="replay-empty">{t.empty}</p>
      ) : done ? (
        <div className="replay-summary">
          <span className="replay-big">{t.items(total)}</span>
          <span>{t.correct(pct)}</span>
        </div>
      ) : (
        <>
          <span className="replay-day">{dayLabel || '…'}</span>
          <div className="replay-bar"><i style={{ width: `${progress * 100}%` }} /></div>
          <p className="replay-sub">{t.sub}</p>
          <div className="replay-legend">
            {['good', 'wrong', 'self'].map((k) => <span key={k} className={`dot-${k}`}>{t.legend[k]}</span>)}
          </div>
        </>
      )}
    </div>
  );
}
