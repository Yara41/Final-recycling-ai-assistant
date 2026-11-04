// Text for the site shell, the Home story and the sorting game, in Modern Standard Arabic and English.
// Arabic copy must stay formal (no dialect): src/lib/__tests__/copy.test.js enforces it.
const COPY = {
  ar: {
    nav: { home: 'الرئيسية', agent: 'الوكيل', learn: 'لعبة الفرز' },
    langSwitch: 'English',
    home: {
      // title: [before, accent, after]
      screens: [
        { kicker: 'وكيل ذكي للاستدامة في جامعتك', title: ['جامعتك ', 'تتنفّس', ' مع كل عبوة تُفرز بشكل صحيح'], text: 'التقط صورة، ويتولّى الوكيل الذكي الباقي.', cta: ['ابدأ مع الوكيل الذكي'], hint: 'مرّر للأسفل' },
        { kicker: 'التقط صورة', title: ['صورة واحدة، ', 'والوكيل يعرف', ''], text: 'يحدّد لك الحاوية الصحيحة فوراً.' },
        { kicker: 'تخلّص منها', title: ['في الحاوية الصحيحة، ', '+10', ''], text: 'نقاط تُضاف إليك وإلى كليتك.' },
        { kicker: 'أبلِغ', title: ['الحاوية ممتلئة؟ ', 'وصل البلاغ', ''], text: 'يرسله الوكيل إلى فريق المرافق تلقائياً.' },
        { kicker: 'للطلبة والموظفين وفريق المرافق ومكتب الاستدامة', title: ['ابدأ ', 'بأول عبوة', ''], cta: ['تحدّث مع الوكيل', 'العب لعبة الفرز'] },
      ],
      scan: 'عبوة بلاستيكية ← الحاوية الزرقاء',
      footer: 'EcoWasteAI · وكيل ذكي لإعادة التدوير في الجامعات',
    },
    game: {
      title: 'لعبة الفرز',
      round: (n) => `الجولة ${n} من ٨`,
      score: 'النتيجة',
      right: 'إجابة صحيحة',
      wrong: (bin) => `الحاوية الصحيحة: ${bin}`,
      endTitle: (n) => `النتيجة ${n} من ٨`,
      endText: 'اسحب الغرض إلى حاويته، أو اضغط اسم الحاوية.',
      again: 'العب مرة أخرى',
      ask: 'اسأل الوكيل',
    },
  },
  en: {
    nav: { home: 'Home', agent: 'Agent', learn: 'Sorting game' },
    langSwitch: 'العربية',
    home: {
      screens: [
        { kicker: 'A smart sustainability agent for your university', title: ['Your campus ', 'breathes', ' with every item sorted right'], text: 'Take a photo. The agent does the rest.', cta: ['Start with the agent'], hint: 'Scroll down' },
        { kicker: 'Take a photo', title: ['One photo, ', 'and the agent knows', ''], text: 'It tells you the right bin straight away.' },
        { kicker: 'Throw it away', title: ['In the right bin, ', '+10', ''], text: 'Points for you and your faculty.' },
        { kicker: 'Report', title: ['Bin full? ', 'Report sent', ''], text: 'The agent sends it to the facilities team by itself.' },
        { kicker: 'For students, staff, facilities and the sustainability office', title: ['Start with ', 'your first item', ''], cta: ['Talk to the agent', 'Play the sorting game'] },
      ],
      scan: 'Plastic bottle → blue bin',
      footer: 'EcoWasteAI · a smart recycling agent for universities',
    },
    game: {
      title: 'Sorting game',
      round: (n) => `Round ${n} of 8`,
      score: 'Score',
      right: 'Correct',
      wrong: (bin) => `Right bin: ${bin}`,
      endTitle: (n) => `You scored ${n} of 8`,
      endText: 'Drag the item onto its bin, or tap the bin name.',
      again: 'Play again',
      ask: 'Ask the agent',
    },
  },
};

export function copy(lang) {
  return COPY[lang === 'en' ? 'en' : 'ar'];
}
