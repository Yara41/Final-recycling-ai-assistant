// Text for the shell, Home and Learn pages, in Arabic and English.
const COPY = {
  ar: {
    nav: { home: 'الرئيسية', agent: 'الإيجنت', learn: 'تعلّم' },
    langSwitch: 'English',
    home: {
      kicker: 'إيجنت الاستدامة لجامعتك',
      title: 'جامعتك حيّة، وكل عبوة تُحدث فرقاً',
      sub: 'صوّر ما سترميه، فيعرف الإيجنت حاويته الصحيحة، ويسجّل أثرك، ويبلّغ فريق المرافق عن الحاويات الممتلئة بنفسه.',
      start: 'تحدث مع الإيجنت',
      how: 'كيف يعمل',
      liveCaption: 'هذا حرم جامعة تجريبية يتغيّر مع كل عملية تدوير حقيقية.',
      stats: { items: 'غرض مُدوَّر خلال 30 يوماً', correct: 'فرز صحيح', co2: 'كغ CO₂e موفّرة (تقديري)' },
      stepsTitle: 'ثلاث خطوات، والإيجنت يتكفّل بالباقي',
      steps: [
        { title: 'صوّر', text: 'صورة واحدة للغرض. يتعرّف عليه الإيجنت ويخبرك بالحاوية الصحيحة حسب قواعد جامعتك.' },
        { title: 'الإيجنت يتصرّف', text: 'يسجّل العملية بنقاطها، ويرسل بلاغاً إذا كانت الحاوية ممتلئة أو مفروزة خطأ.' },
        { title: 'شوف أثرك', text: 'نقاطك وكليتك والأشجار التي تنمو حول مبناها على حرم جامعتك الحيّ.' },
      ],
      roles: {
        title: 'لكل من في الجامعة',
        items: [
          { who: 'الطلاب والموظفون', what: 'فرز صحيح ونقاط موثّقة بالصور.' },
          { who: 'فريق المرافق', what: 'بلاغات مرتّبة حسب الأولوية، وفحص الحاويات بالصورة.' },
          { who: 'مكتب الاستدامة', what: 'تقرير أسبوعي يكتبه الإيجنت بثلاث توصيات.' },
        ],
      },
      research: {
        title: 'مبني على بحث ميداني',
        text: 'في دراسة على 165 شخصاً من جامعتين، كانت العلاقة بين نية إعادة التدوير والتدوير الفعلي أقوى بنحو الضعف عند من استخدموا الإيجنت أكثر.',
        low: 'استخدام قليل',
        high: 'استخدام كثير',
        note: 'معامل الأثر (β) في نموذج الدراسة. علاقة ارتباط وليست سببية.',
      },
      footer: 'EcoWasteAI · إيجنت ذكاء اصطناعي لإعادة التدوير في الجامعات',
    },
    learn: {
      kicker: 'دليل الفرز',
      title: 'افرز صح، من أول مرة',
      sub: 'قواعد بسيطة تنطبق على أغلب الجامعات. الإيجنت يعرف قواعد جامعتك بالتحديد.',
      rules: [
        { title: 'نظيف وجاف', text: 'العبوات المشطوفة والورق الجاف فقط تُعاد تدويرها.' },
        { title: 'الدهون تفسد الورق', text: 'علب البيتزا الدهنية والمناديل المستعملة للنفايات العامة.' },
        { title: 'البطاريات منفصلة', text: 'البطاريات والإلكترونيات لنقاط التسليم الخاصة فقط.' },
      ],
      guide: 'افتح دليل الفرز المصوّر',
      ask: 'اسأل الإيجنت عن أي غرض',
    },
  },
  en: {
    nav: { home: 'Home', agent: 'Agent', learn: 'Learn' },
    langSwitch: 'العربية',
    home: {
      kicker: "Your university's sustainability agent",
      title: 'Your campus is alive. Every bottle counts.',
      sub: 'Snap what you are throwing away. The agent knows the right bin, logs your impact and reports full bins to the facilities team by itself.',
      start: 'Talk to the agent',
      how: 'How it works',
      liveCaption: 'A demo campus that changes with every real recycling action.',
      stats: { items: 'items recycled in 30 days', correct: 'correctly sorted', co2: 'kg CO₂e saved (estimate)' },
      stepsTitle: 'Three steps. The agent does the rest.',
      steps: [
        { title: 'Snap', text: "One photo of the item. The agent recognises it and tells you the right bin under your university's rules." },
        { title: 'The agent acts', text: 'It logs the item with its points and files a report when a bin is full or mis-sorted.' },
        { title: 'See your impact', text: 'Your points, your faculty, and the trees growing around its building on your living campus.' },
      ],
      roles: {
        title: 'For everyone on campus',
        items: [
          { who: 'Students and staff', what: 'Correct sorting and photo-verified points.' },
          { who: 'Facilities team', what: 'Bin reports by priority and photo audits of bins.' },
          { who: 'Sustainability office', what: 'A weekly report the agent writes, with three recommendations.' },
        ],
      },
      research: {
        title: 'Built on field research',
        text: 'In a study of 165 people at two universities, the link between intending to recycle and actually recycling was about twice as strong for people who used the agent more.',
        low: 'Light use',
        high: 'Heavy use',
        note: "Effect coefficient (β) in the study's model. An association, not proof of cause.",
      },
      footer: 'EcoWasteAI · an AI agent for university recycling',
    },
    learn: {
      kicker: 'Sorting guide',
      title: 'Sort it right, the first time',
      sub: "Simple rules that hold at most universities. The agent knows your university's exact rules.",
      rules: [
        { title: 'Clean and dry', text: 'Only rinsed containers and dry paper can be recycled.' },
        { title: 'Grease ruins paper', text: 'Greasy pizza boxes and used tissues go to general waste.' },
        { title: 'Batteries apart', text: 'Batteries and electronics go to special drop-off points only.' },
      ],
      guide: 'Open the illustrated sorting guide',
      ask: 'Ask the agent about any item',
    },
  },
};

export function copy(lang) {
  return COPY[lang === 'en' ? 'en' : 'ar'];
}
