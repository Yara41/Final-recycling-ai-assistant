// Words drawn inside the 3D campus (bin labels and tags), Arabic and English.
export const TEXT = {
  ar: {
    bins: { general: 'نفايات عامة', paper: 'ورق وكرتون', plastic: 'بلاستيك', metal: 'معادن' },
    reportSent: 'تم إرسال البلاغ ✓',
    notHere: 'ليست هنا',
    offline: 'غير متصل',
    stillAlt: (phase) => `حرم جامعي من الحجر ${{ dawn: 'عند الفجر', day: 'في النهار', sunset: 'عند الغروب', night: 'في الليل' }[phase] ?? ''}`,
  },
  en: {
    bins: { general: 'General waste', paper: 'Paper & card', plastic: 'Plastic', metal: 'Metal' },
    reportSent: 'Report sent ✓',
    notHere: 'Not this one',
    offline: 'Offline',
    stillAlt: (phase) => `A limestone campus at ${phase}`,
  },
};

export const text = (lang) => TEXT[lang === 'en' ? 'en' : 'ar'];
