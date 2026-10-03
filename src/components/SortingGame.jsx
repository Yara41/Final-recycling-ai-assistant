// src/components/SortingGame.jsx
import React, { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw, ArrowLeft, ArrowRight, Trophy } from 'lucide-react';
import './SortingGame.css';

/* The 4 bins, in the SAME left-to-right order as they appear in /bins.jpg */
const BINS = [
  { id: 'general', ar: 'نفايات عامة', en: 'General waste' },
  { id: 'plastic', ar: 'بلاستيك', en: 'Plastic' },
  { id: 'paper', ar: 'ورق وكرتون', en: 'Paper & cardboard' },
  { id: 'metal', ar: 'معادن', en: 'Metals' },
];

/* Items. Each one has a photo in /public/items/. To add an item: put the image there and add a line here. */
const ITEMS = [
  { id: 'bottle', img: '/items/bottle.webp', bin: 'plastic', ar: 'زجاجة مياه بلاستيكية', en: 'Plastic water bottle',
    tipAr: 'البلاستيك النظيف مكانه سلة البلاستيك. فرّغها واشطفها قبل الرمي.',
    tipEn: 'Clean plastic goes in the plastic bin. Empty and rinse it first.' },
  { id: 'can', img: '/items/can.webp', bin: 'metal', ar: 'علبة مشروب غازي', en: 'Soda can',
    tipAr: 'علب الألمنيوم مكانها سلة المعادن، ويُعاد تدويرها مرات كثيرة.',
    tipEn: 'Aluminium cans go in the metals bin and can be recycled again and again.' },
  { id: 'paper', img: '/items/paper.webp', bin: 'paper', ar: 'ورقة مجعّدة', en: 'Crumpled paper',
    tipAr: 'الورق النظيف والجاف يُعاد تدويره حتى لو كان مجعّدًا.',
    tipEn: 'Clean, dry paper can be recycled even when crumpled.' },
  { id: 'cardboard', img: '/items/cardboard.webp', bin: 'paper', ar: 'كرتونة مفرودة', en: 'Flattened cardboard box',
    tipAr: 'الكرتون النظيف مكانه سلة الورق والكرتون. افرده قبل الرمي لتوفّر مساحة.',
    tipEn: 'Clean cardboard goes in the paper & cardboard bin. Flatten it to save space.' },
  { id: 'pizza', img: '/items/pizza.webp', bin: 'general', ar: 'علبة بيتزا عليها دهون', en: 'Greasy pizza box',
    tipAr: 'الكرتون الملوّث بالدهون والأكل لا يُعاد تدويره، مكانه النفايات العامة.',
    tipEn: 'Cardboard soiled with grease cannot be recycled. It goes in general waste.' },
  { id: 'banana', img: '/items/banana.webp', bin: 'general', ar: 'قشر موز', en: 'Banana peel',
    tipAr: 'بقايا الأكل مكانها النفايات العامة، ولا تخلطها مع المواد القابلة للتدوير.',
    tipEn: 'Food scraps go in general waste. Do not mix them with recyclables.' },
  { id: 'tissue', img: '/items/tissue.webp', bin: 'general', ar: 'محارم مستعملة', en: 'Used tissues',
    tipAr: 'المحارم المستعملة مكانها النفايات العامة، لأن الألياف تتلف بالاستخدام والرطوبة.',
    tipEn: 'Used tissues go in general waste because the fibres are soiled and damp.' },
  { id: 'chips', img: '/items/chips.webp', bin: 'general', ar: 'كيس شيبس فارغ', en: 'Empty chips bag',
    tipAr: 'الكيس من طبقات بلاستيك وألمنيوم ملتصقة يصعب تدويرها، مكانه النفايات العامة.',
    tipEn: 'The bag is made of bonded plastic and foil layers that are hard to recycle. General waste.' },
];

const TEXT = {
  ar: {
    kicker: 'لعبة تعلّم', title: 'وين مكانها؟', sub: 'اضغط على السلة الصحيحة لكل غرض.',
    round: 'السؤال', score: 'النتيجة', right: 'صحيح!', wrong: 'خطأ', rightBin: 'مكانها:',
    next: 'التالي', finish: 'شاهد النتيجة', again: 'العب مرة ثانية', yourScore: 'نتيجتك',
    great: 'ممتاز! أنت خبير فرز.', good: 'جيد جدًا! بقي القليل.', keep: 'حاول مرة ثانية، ومراجعة الدليل بتساعدك.',
    pick: 'اختر السلة', binsAlt: 'سلال الفرز: نفايات عامة، بلاستيك، ورق وكرتون، معادن',
  },
  en: {
    kicker: 'Learning game', title: 'Where does it go?', sub: 'Tap the correct bin for each item.',
    round: 'Question', score: 'Score', right: 'Correct!', wrong: 'Not quite', rightBin: 'It goes in:',
    next: 'Next', finish: 'See result', again: 'Play again', yourScore: 'Your score',
    great: 'Excellent! You are a sorting expert.', good: 'Very good! Almost there.', keep: 'Try again, and the guide above will help.',
    pick: 'Choose a bin', binsAlt: 'Sorting bins: general waste, plastic, paper & cardboard, metals',
  },
};

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default function SortingGame({ lang = 'ar' }) {
  const t = TEXT[lang === 'en' ? 'en' : 'ar'];
  const L = lang === 'en' ? 'en' : 'ar';
  const dir = L === 'en' ? 'ltr' : 'rtl';

  const [order, setOrder] = useState(() => shuffle(ITEMS));
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [answer, setAnswer] = useState(null); // { picked, ok }
  const [done, setDone] = useState(false);

  const item = order[idx];
  const total = order.length;
  const binName = useMemo(() => Object.fromEntries(BINS.map((b) => [b.id, b[L]])), [L]);

  const pick = (binId) => {
    if (answer || done) return;
    const ok = binId === item.bin;
    setAnswer({ picked: binId, ok });
    if (ok) setScore((s) => s + 1);
  };

  const next = () => {
    if (idx + 1 >= total) { setDone(true); return; }
    setIdx((i) => i + 1);
    setAnswer(null);
  };

  const restart = () => {
    setOrder(shuffle(ITEMS));
    setIdx(0); setScore(0); setAnswer(null); setDone(false);
  };

  const NextIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const resultMsg = score >= total * 0.8 ? t.great : score >= total * 0.5 ? t.good : t.keep;

  return (
    <section className="sg-sec" id="sorting-game" dir={dir} aria-labelledby="sg-title">
      <div className="sg-card">
        <header className="sg-head">
          <span className="sg-kicker">{t.kicker}</span>
          <h2 id="sg-title">{t.title}</h2>
          <p>{t.sub}</p>
        </header>

        {!done ? (
          <>
            <div className="sg-bar">
              <span>{t.round} <b>{idx + 1}</b> / {total}</span>
              <div className="sg-track" aria-hidden="true"><i style={{ width: `${((idx + (answer ? 1 : 0)) / total) * 100}%` }} /></div>
              <span>{t.score} <b>{score}</b></span>
            </div>

            <div className={`sg-item ${answer ? (answer.ok ? 'ok' : 'bad') : ''}`} key={item.id} aria-live="polite">
              {item.img
                ? <img src={item.img} alt="" />
                : <span className="sg-emoji" aria-hidden="true">{item.emoji}</span>}
              <strong>{item[L]}</strong>
            </div>

            <div className="sg-bins">
              <img src="/bins.jpg" alt={t.binsAlt} draggable="false" />
              <div className="sg-hits" dir="ltr">
                {BINS.map((b) => {
                  const state = !answer ? '' : b.id === item.bin ? 'correct' : answer.picked === b.id ? 'wrong' : 'dim';
                  return (
                    <button
                      key={b.id}
                      type="button"
                      className={`sg-hit ${state}`}
                      onClick={() => pick(b.id)}
                      disabled={!!answer}
                      aria-label={`${t.pick}: ${b[L]}`}
                    >
                      {state === 'correct' && <CheckCircle2 size={34} aria-hidden="true" />}
                      {state === 'wrong' && <XCircle size={34} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`sg-feedback ${answer ? (answer.ok ? 'ok' : 'bad') : 'idle'}`} role="status">
              {answer ? (
                <>
                  <div className="sg-fb-text">
                    <strong>
                      {answer.ok ? <CheckCircle2 size={20} aria-hidden="true" /> : <XCircle size={20} aria-hidden="true" />}
                      {answer.ok ? t.right : t.wrong}
                    </strong>
                    <span>
                      {!answer.ok && <>{t.rightBin} <b>{binName[item.bin]}</b>. </>}
                      {item[L === 'en' ? 'tipEn' : 'tipAr']}
                    </span>
                  </div>
                  <button type="button" className="sg-next" onClick={next}>
                    {idx + 1 >= total ? t.finish : t.next} <NextIcon size={17} aria-hidden="true" />
                  </button>
                </>
              ) : (
                <span className="sg-hint">{t.sub}</span>
              )}
            </div>
          </>
        ) : (
          <div className="sg-result">
            <Trophy size={52} aria-hidden="true" />
            <h3>{t.yourScore}: {score} / {total}</h3>
            <p>{resultMsg}</p>
            <button type="button" className="sg-next" onClick={restart}>
              <RotateCcw size={17} aria-hidden="true" /> {t.again}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}