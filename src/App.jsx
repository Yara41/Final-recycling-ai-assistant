import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowUp,
  Camera,
  CheckCircle2,
  XCircle,
  Leaf,
  Menu,
  History,
  Plus,
  Trash2,
  Sparkles,
  X,
  ShieldAlert,
  Recycle,
  Repeat,
  TrendingDown,
  TrendingUp,
  Milk,
  CircleDot,
  SprayCan,
  Box,
  Popcorn,
  Candy,
  Newspaper,
  BookOpen,
  ShoppingBag,
  Pizza,
  Paperclip,
  CupSoda,
  Soup,
  FlaskConical,
  Utensils,
  Wrench,
  Wind,
  Cigarette,
  Coffee,
  Disc,
  Brush,
  FileText,
  ShowerHead,
  Shuffle,
  Droplet,
  Truck,
  Package,
  GlassWater,
  Globe,
  ExternalLink,
  ChevronDown,
  Download,
  ZoomIn,
} from 'lucide-react';
import JordanUniversityMap from './components/JordanUniversityMap';
import SortingGame from './components/SortingGame';
import './App.css';

// ===== الترجمة (عربي ↔ إنكليزي): المفتاح هو النص العربي =====
const EN = {
  'عن EcoWasteAI': 'About EcoWasteAI',
  'مساعد ذكي لتعليم إعادة التدوير داخل الجامعة': 'A smart assistant for recycling education on campus',
  'EcoWasteAI مساعد ذكي يساعد طلاب الجامعة على فهم إعادة التدوير والفرز الصحيح للنفايات، ومعرفة الحاوية المناسبة لكل نوع، من خلال المحادثة أو تصوير النفاية.': 'EcoWasteAI is a smart assistant that helps university students understand recycling and proper waste sorting, and find the right bin for each type, through chat or by photographing the waste.',
  'صُمم ليكون بسيطاً وقريباً من الناس: اسأل بالعربية أو الإنكليزية، أو صوّر أي نفاية ليخبرك الوكيل أين ترميها وكيف تجهّزها.': 'It is designed to be simple and close to people: ask in Arabic or English, or photograph any waste and the agent will tell you where to throw it and how to prepare it.',
  'فكرتنا أن الاستدامة تبدأ بخطوة صغيرة: وعي أكبر، فرز أنظف، وجامعة أذكى وبيئة أنظف.': 'Our idea is that sustainability starts with a small step: more awareness, cleaner sorting, a smarter campus and a cleaner environment.',
  'تعرّف على المساعد': 'Meet the assistant',
  'دليل الفرز': 'Sorting guide',
  'اضغط لعرض الدليل كاملاً': 'Click to view the full guide',
  'اضغط للتكبير': 'Tap to zoom',
  'لا تخلط النفايات وتلوّثها، أعد التدوير بشكل صحيح': "Don't mix waste and contaminate it, recycle properly",
  'صُمم هذا الدليل لمساعدتك على معرفة الحاوية الصحيحة لكل نوع من النفايات في الجامعة: بلاستيك، معدن، زجاج، وورق وكرتون.': 'This guide helps you find the right bin for each type of waste on campus: plastic, metal, glass, and paper & cardboard.',
  'قبل الرمي، فرّغ العبوة واشطفها، وافرد الكرتون. النفايات النظيفة والجافة فقط هي التي يُعاد تدويرها.': 'Before throwing, empty and rinse the container and flatten cardboard. Only clean, dry waste can be recycled.',
  'تحميل الدليل': 'Download the guide',
  'دليلك العملي لإعادة التدوير': 'Your practical guide to recycling', 'فرز أنظف': 'Cleaner sorting', 'أثر أكبر': 'Bigger impact', 'ابدأ الدليل': 'Start the guide',
  'الرئيسية': 'Home', 'اسأل الوكيل': 'Ask the agent', 'نحو جامعة أذكى وبيئة أنظف': 'Towards a smarter campus and a cleaner environment',
  "المساعد": "Assistant",
  "تعلّم": "Learn",
  "المحادثات": "Chats",
  "محادثاتي": "My chats",
  "محادثة جديدة": "New chat",
  "لا توجد محادثات محفوظة بعد.": "No saved chats yet.",
  "حذف المحادثة": "Delete chat",
  "هل تريد حذف هذه المحادثة؟": "Do you want to delete this chat?",
  "محادثة سابقة": "Previous chat",
  "تصنيف صورة نفاية": "Waste photo classification",
  "موقع أمانة عمّان": "Greater Amman Municipality",
  "خدمات البلدية وإدارة النفايات في العاصمة": "Municipal services and waste management in the capital",
  "مبادرة AVTR": "AVTR Initiative",
  "منصة لإعادة التدوير وتعزيز المشاركة المجتمعية": "A recycling platform that promotes community participation",
  "جاري البحث...": "Searching...",
  "جاري تحليل الصورة...": "Analyzing the image...",
  "لم تصل إجابة من الخادم.": "No answer came back from the server.",
  "الخادم غير متاح حالياً، حاول لاحقاً.": "The server is unavailable right now, please try again later.",
  "لم أتعرّف على نفاية في الصورة. جرّب صورة أوضح وأقرب للعنصر.": "I couldn't recognize any waste in the photo. Try a clearer, closer picture.",
  "تعذّر تحليل الصورة حالياً، حاول مرة أخرى.": "Couldn't analyze the image right now, please try again.",
  "مرحباً بك في EcoWasteAI 🌱\n\nأنا مساعدك الذكي للتعرّف على ممارسات إعادة التدوير والاستدامة. اسألني عن فرز النفايات أو الاستدامة داخل الجامعة.": "Welcome to EcoWasteAI 🌱\n\nI'm your smart assistant for recycling and sustainability practices. Ask me about waste sorting or sustainability on campus.",
  "الاستدامة تبدأ بخطوة": "Sustainability starts with a step",
  "خطوة صغيرة،": "A small step,",
  "أثر كبير.": "a big impact.",
  "اسألني عن إعادة التدوير والفرز، أو صوّر أي نفاية وأخبرك أين ترميها.": "Ask me about recycling and sorting, or photograph any waste and I'll tell you where to throw it.",
  "اكتب سؤالك هنا...": "Type your question here...",
  "كيف يمكن فرز النفايات داخل الجامعة؟": "How can waste be sorted on campus?",
  "كيف أفرز النفايات؟": "How do I sort waste?",
  "ما أهمية إعادة التدوير؟": "Why is recycling important?",
  "لماذا نعيد التدوير؟": "Why do we recycle?",
  "هل علبة البيتزا الدهنية تُعاد تدويرها؟": "Can a greasy pizza box be recycled?",
  "هل علبة البيتزا تُعاد تدويرها؟": "Can a pizza box be recycled?",
  "صوّر نفاية": "Photograph waste",
  "البلاستيك": "Plastic",
  "الورق والكرتون": "Paper & cardboard",
  "المعادن": "Metals",
  "الزجاج": "Glass",
  "نفايات عضوية": "Organic waste",
  "نفايات خطرة": "Hazardous waste",
  "نفايات عامة": "General waste",
  "قابلة لإعادة التدوير": "Recyclable",
  "غير قابلة لإعادة التدوير": "Not recyclable",
  "النتيجة غير مؤكدة، جرّب صورة أوضح.": "Result uncertain, try a clearer photo.",
  "اسأل عن طريقة التخلص": "Ask how to dispose of it",
  "دليل الاستدامة والفرز": "Sustainability & sorting guide",
  "كن جزءاً من الحل،": "Be part of the solution,",
  "ولا تكن سبباً في التلوث.": "don't be a cause of pollution.",
  "تعلّم كيف تقلّل، وتعيد الاستخدام، وتفرز نفاياتك بالشكل الصحيح.": "Learn how to reduce, reuse, and sort your waste properly.",
  "القاعدة الذهبية": "The golden rule",
  "ابدأ من الأعلى: ٣ خطوات لنفايات أقل": "Start at the top: 3 steps to less waste",
  "تقليل الاستخدام": "Reduce",
  "إعادة الاستخدام": "Reuse",
  "إعادة التدوير": "Recycle",
  "ارفض الأكياس والأدوات البلاستيكية أحادية الاستخدام، واحمل قارورة وكوباً خاصين بك.": "Refuse single-use bags and plastic items, and carry your own bottle and cup.",
  "استخدم العبوات والأكياس والدفاتر مرة أخرى قبل رميها، واكتب على وجهَي الورقة.": "Use containers, bags and notebooks again before throwing them away, and write on both sides of the paper.",
  "افرز المواد النظيفة والجافة في الحاوية الصحيحة ليُعاد تصنيعها.": "Sort clean, dry materials into the right bin so they can be remanufactured.",
  "الفرز الصحيح": "Proper sorting",
  "كيف تفرز في 4 خطوات؟": "How to sort in 4 steps?",
  "فرّغ": "Empty",
  "أفرغ العبوة من السوائل وبقايا الطعام.": "Empty the container of liquids and food residue.",
  "اشطف": "Rinse",
  "اشطفها بسرعة واتركها تجف. لا حاجة لإزالة الملصقات.": "Rinse it quickly and let it dry. No need to remove labels.",
  "افصل": "Separate",
  "افصل المواد حسب نوعها: بلاستيك، ورق، معادن.": "Separate materials by type: plastic, paper, metal.",
  "ارمِ": "Dispose",
  "ضعها في الحاوية الخاصة بها دون خلط.": "Place it in its own bin without mixing.",
  "ابحث عن رمز التدوير على العبوة (مثل PET وHDPE وPP) للتأكد من أنها قابلة لإعادة التدوير.": "Look for the recycling symbol on the packaging (e.g. PET, HDPE, PP) to make sure it is recyclable.",
  "دليل الحاويات": "Bin guide",
  "ماذا أضع في كل حاوية؟": "What goes in each bin?",
  "مقبول": "Accepted",
  "غير مقبول": "Not accepted",
  "عبوات المياه والمشروبات النظيفة": "Clean water and drink bottles",
  "الأغطية البلاستيكية": "Plastic caps",
  "عبوات الشامبو والمنظفات الفارغة": "Empty shampoo and detergent bottles",
  "البوليسترين والفوم (علب الوجبات)": "Polystyrene and foam (meal boxes)",
  "أكياس الشيبس والحلويات": "Chips and candy bags",
  "تغليف الشوكولاتة والأكياس المتسخة": "Chocolate wrappers and dirty bags",
  "الصحف والمجلات": "Newspapers and magazines",
  "صناديق الكرتون النظيفة والمسطحة": "Clean, flattened cardboard boxes",
  "الكتب والدفاتر وأكياس الورق": "Books, notebooks and paper bags",
  "المناديل الورقية والفوط المستعملة": "Used tissues and sanitary pads",
  "الكرتون الدهني أو الملوث بالطعام": "Greasy or food-soiled cardboard",
  "الورق المختلط بمواد لاصقة قوية": "Paper mixed with strong adhesives",
  "علب المشروبات الغازية والعصير": "Soda and juice cans",
  "علب الطعام المعدنية النظيفة": "Clean metal food cans",
  "أغطية العبوات المعدنية النظيفة": "Clean metal container lids",
  "عبوات فيها بقايا أو مواد خطرة": "Containers with residue or hazardous materials",
  "ألمنيوم متسخ بالزيوت وبقايا الطعام": "Aluminum dirty with oil and food scraps",
  "الأدوات الحادة والمعادن الثقيلة": "Sharp tools and heavy metals",
  "النفايات الخطرة لها مسار آخر": "Hazardous waste has a different path",
  "البطاريات والأدوية لا تُخلط مع النفايات القابلة لإعادة التدوير. سلّمها لنقاط الجمع المخصصة.": "Batteries and medicines must not be mixed with recyclables. Hand them in at designated collection points.",
  "الأثر البيئي": "Environmental impact",
  "كم تحتاج النفاية لتتحلل؟": "How long does waste take to decompose?",
  "الورق": "Paper",
  "أعقاب السجائر": "Cigarette butts",
  "كوب القهوة": "Coffee cup",
  "علب الألمنيوم": "Aluminum cans",
  "إطارات السيارات": "Car tires",
  "فرشاة الأسنان": "Toothbrush",
  "القوارير البلاستيكية": "Plastic bottles",
  "الأدوات البلاستيكية": "Plastic utensils",
  "الأكياس البلاستيكية": "Plastic bags",
  "2–3 أشهر": "2–3 months",
  "+10 سنوات": "10+ years",
  "30 سنة": "30 years",
  "200 سنة": "200 years",
  "+500 سنة": "500+ years",
  "+1000 سنة": "1000+ years",
  "10 – +1000 سنة": "10 – 1000+ years",
  "طول الأعمدة تقريبي للمقارنة. المصدر: مشروع إعادة التدوير في الأردن (USAID).": "Bar lengths are approximate, for comparison. Source: Jordan Recycling Project (USAID).",
  "الواقع في عمّان": "Reality in Amman",
  "ماذا نرمي في عمّان؟": "What do we throw away in Amman?",
  "3,200 طن": "3,200 tons",
  "تصل يومياً إلى مكب الغباوي (2022)": "arrive daily at Al-Ghabawi landfill (2022)",
  "نسبة إعادة التدوير التقديرية في عمّان": "Estimated recycling rate in Amman",
  "الزيادة السنوية في إنتاج النفايات": "Annual increase in waste production",
  "عضوية": "Organic",
  "بلاستيك": "Plastic",
  "ورق": "Paper",
  "كرتون": "Cardboard",
  "مناديل وفوط صحية": "Tissues & sanitary pads",
  "غير مصنّف": "Unclassified",
  "نسيج": "Textiles",
  "زجاج": "Glass",
  "معادن ومواد مركبة وخطرة": "Metals, composites & hazardous",
  "ما يقارب ثلث النفايات (بلاستيك وورق وكرتون) قابل لإعادة التدوير إذا فُرز نظيفاً.": "Roughly a third of waste (plastic, paper and cardboard) is recyclable if sorted clean.",
  "المصدر: بيانات أمانة عمّان الكبرى عبر مشروع إعادة التدوير في الأردن (USAID).": "Source: Greater Amman Municipality data via the Jordan Recycling Project (USAID).",
  "التعليمات الذهبية لفرز نظيف ومثالي": "Golden instructions for clean, perfect sorting",
  "يجب أن يكون \"نظيفاً\"! اشطف العبوات البلاستيكية والمعدنية لإزالة بقايا الطعام والشراب.": "It must be \"clean\"! Rinse plastic and metal containers to remove food and drink residue.",
  "قم بإعادة تدوير المواد الورقية والكرتونية النظيفة والجافة فقط.": "Only recycle clean, dry paper and cardboard.",
  "لا تقم بإعادة تدوير الكرتون الذي يحمل بقع دهنية أو بقايا طعام (يمكنك إزالة الجزء المتسخ وفرز ما تبقى).": "Do not recycle cardboard with grease stains or food residue (you can tear off the dirty part and sort the rest).",
  "لا تقم بإعادة تدوير المناديل الورقية أو الفوط المستعملة لكونها ملوثة.": "Do not recycle used tissues or pads, as they are contaminated.",
  "تأكد من وجود الرموز البيئية للمواد التي يعاد تدويرها على العبوات ومواد التغليف (مثل: PP, PET, HDPE).": "Check for the recycling symbols on packaging (e.g. PP, PET, HDPE).",
  "تخلص من النفايات الخطرة (مثل البطاريات والأدوية) في نقاط الجمع المخصصة ولا تخلطها أبداً.": "Dispose of hazardous waste (such as batteries and medicines) at designated collection points and never mix it.",
  "مو متأكد وين ترمي؟": "Not sure where to throw it?",
  "افتح المساعد وصوّر النفاية، وEcoWasteAI يخبرك.": "Open the assistant and photograph the waste, and EcoWasteAI will tell you.",
  "افتح المساعد": "Open the assistant",
  'اسأل': 'Ask',
  'صوّر': 'Scan',
  'الأثر': 'Impact',
  'فرز أنظف يعني جامعة أذكى وبيئة أنظف؛ وكل خطوة صغيرة منك تصنع فرقاً كبيراً مع الوقت.': 'Cleaner sorting means a smarter campus and a cleaner environment; every small step makes a big difference over time.',
  'اسأل الوكيل الذكي عن أي نفاية بالعربية أو الإنكليزية، واحصل على إجابة سريعة وواضحة.': 'Ask the smart agent about any waste in Arabic or English and get a quick, clear answer.',
  'دليل بسيط ومصوّر يشرح الفرز الصحيح لكل نوع من النفايات داخل الجامعة.': 'A simple, visual guide to sorting each type of waste correctly on campus.',
  'صوّر أي نفاية بكاميرا هاتفك، وسيتعرّف عليها EcoWasteAI ويخبرك أين ترميها.': 'Photograph any waste with your phone and EcoWasteAI will identify it and tell you where to throw it.',
  'خريطة الأردن': 'Map of Jordan',
  'جامعات الأردن، من إربد إلى العقبة': "Jordan's universities, from Irbid to Aqaba",
  'تنتشر الجامعات الأردنية بين الشمال والجنوب، وكل واحدة منها تقدر تبدأ بخطوة فرز صحيحة. هدفنا أن يصل EcoWasteAI لكل طالب في كل جامعة.': 'Jordan\'s universities are spread from north to south, and each one can start with a single step of correct sorting. Our goal is for EcoWasteAI to reach every student in every university.',
  'مرّر على النقاط أو اضغط على اسم الجامعة. المواقع تقريبية.': 'Hover over the dots or tap a university name. Locations are approximate.',
  'الجامعة الأردنية': 'University of Jordan',
  'جامعة العلوم والتكنولوجيا': 'Jordan University of Science and Technology',
  'جامعة اليرموك': 'Yarmouk University',
  'الجامعة الهاشمية': 'The Hashemite University',
  'جامعة مؤتة': 'Mutah University',
  'جامعة آل البيت': 'Al al-Bayt University',
  'جامعة البلقاء التطبيقية': 'Al-Balqa Applied University',
  'جامعة الطفيلة التقنية': 'Tafila Technical University',
  'جامعة الحسين بن طلال': 'Al-Hussein Bin Talal University',
  'الجامعة الألمانية الأردنية': 'German Jordanian University',
  'جامعة العقبة للتكنولوجيا': 'Aqaba University of Technology',
  'عمّان': 'Amman', 'إربد': 'Irbid', 'الزرقاء': 'Zarqa', 'الكرك': 'Karak', 'المفرق': 'Mafraq', 'السلط': 'Salt', 'الطفيلة': 'Tafila', 'معان': "Ma'an", 'العقبة': 'Aqaba',
};
let LANG = 'ar';
const tr = (text) => (LANG === 'en' ? EN[text] ?? text : text);

const SIDE_LINKS = [
  { href: 'https://www.ammancity.gov.jo', title: 'موقع أمانة عمّان', desc: 'خدمات البلدية وإدارة النفايات في العاصمة' },
  { href: 'https://avtr.jo', title: 'مبادرة AVTR', desc: 'منصة لإعادة التدوير وتعزيز المشاركة المجتمعية' },
];

const BIN_COLORS = {
  plastic: { a: '#e11d48', b: '#9f1239', soft: '#fff1f3' },
  paper: { a: '#3b82f6', b: '#1e3a8a', soft: '#eff4ff' },
  metal: { a: '#7dbcf5', b: '#2f6fb5', soft: '#eef6ff' },
};

const learnBins = [
  {
    id: 'plastic',
    title: 'البلاستيك',
    accepted: [
      [Milk, 'عبوات المياه والمشروبات النظيفة'],
      [CircleDot, 'الأغطية البلاستيكية'],
      [SprayCan, 'عبوات الشامبو والمنظفات الفارغة'],
    ],
    rejected: [
      [Box, 'البوليسترين والفوم (علب الوجبات)'],
      [Popcorn, 'أكياس الشيبس والحلويات'],
      [Candy, 'تغليف الشوكولاتة والأكياس المتسخة'],
    ],
  },
  {
    id: 'paper',
    title: 'الورق والكرتون',
    accepted: [
      [Newspaper, 'الصحف والمجلات'],
      [Package, 'صناديق الكرتون النظيفة والمسطحة'],
      [BookOpen, 'الكتب والدفاتر وأكياس الورق'],
    ],
    rejected: [
      [Wind, 'المناديل الورقية والفوط المستعملة'],
      [Pizza, 'الكرتون الدهني أو الملوث بالطعام'],
      [Paperclip, 'الورق المختلط بمواد لاصقة قوية'],
    ],
  },
  {
    id: 'metal',
    title: 'المعادن',
    accepted: [
      [CupSoda, 'علب المشروبات الغازية والعصير'],
      [Soup, 'علب الطعام المعدنية النظيفة'],
      [Disc, 'أغطية العبوات المعدنية النظيفة'],
    ],
    rejected: [
      [FlaskConical, 'عبوات فيها بقايا أو مواد خطرة'],
      [Utensils, 'ألمنيوم متسخ بالزيوت وبقايا الطعام'],
      [Wrench, 'الأدوات الحادة والمعادن الثقيلة'],
    ],
  },
];

const threeRs = [
  { id: 'reduce', title: 'تقليل الاستخدام', a: '#f43f5e', b: '#be123c', Icon: TrendingDown, tip: 'ارفض الأكياس والأدوات البلاستيكية أحادية الاستخدام، واحمل قارورة وكوباً خاصين بك.' },
  { id: 'reuse', title: 'إعادة الاستخدام', a: '#3b82f6', b: '#1d4ed8', Icon: Repeat, tip: 'استخدم العبوات والأكياس والدفاتر مرة أخرى قبل رميها، واكتب على وجهَي الورقة.' },
  { id: 'recycle', title: 'إعادة التدوير', a: '#22c55e', b: '#15803d', Icon: Recycle, tip: 'افرز المواد النظيفة والجافة في الحاوية الصحيحة ليُعاد تصنيعها.' },
];

const sortSteps = [
  [Droplet, 'فرّغ', 'أفرغ العبوة من السوائل وبقايا الطعام.'],
  [ShowerHead, 'اشطف', 'اشطفها بسرعة واتركها تجف. لا حاجة لإزالة الملصقات.'],
  [Shuffle, 'افصل', 'افصل المواد حسب نوعها: بلاستيك، ورق، معادن.'],
  [Trash2, 'ارمِ', 'ضعها في الحاوية الخاصة بها دون خلط.'],
];

// المصدر: مشروع إعادة التدوير في الأردن (USAID). w = عرض تقريبي للمقارنة فقط
const degradeTimes = [
  { Icon: FileText, name: 'الورق', value: '2–3 أشهر', w: 3 },
  { Icon: Cigarette, name: 'أعقاب السجائر', value: '+10 سنوات', w: 10 },
  { Icon: Coffee, name: 'كوب القهوة', value: '30 سنة', w: 18 },
  { Icon: CupSoda, name: 'علب الألمنيوم', value: '200 سنة', w: 40 },
  { Icon: Disc, name: 'إطارات السيارات', value: '200 سنة', w: 40 },
  { Icon: Brush, name: 'فرشاة الأسنان', value: '+500 سنة', w: 62 },
  { Icon: Milk, name: 'القوارير البلاستيكية', value: '+500 سنة', w: 62 },
  { Icon: Utensils, name: 'الأدوات البلاستيكية', value: '+1000 سنة', w: 100 },
  { Icon: ShoppingBag, name: 'الأكياس البلاستيكية', value: '10 – +1000 سنة', w: 100 },
];
const tone = (w) => (w < 20 ? '#10b981' : w < 45 ? '#f59e0b' : w < 70 ? '#f97316' : '#dc2626');

// المصدر: بيانات أمانة عمّان الكبرى (GAM) عبر مشروع إعادة التدوير في الأردن
const wasteComposition = [
  { name: 'نفايات عضوية', v: 50, c: '#94a3b8' },
  { name: 'بلاستيك', v: 16, c: '#e11d48' },
  { name: 'ورق', v: 8, c: '#2563eb' },
  { name: 'كرتون', v: 7, c: '#7c9cf0' },
  { name: 'مناديل وفوط صحية', v: 5, c: '#a16207' },
  { name: 'غير مصنّف', v: 5, c: '#d6c3a3' },
  { name: 'نسيج', v: 3, c: '#a3b82f' },
  { name: 'زجاج', v: 3, c: '#14b8a6' },
  { name: 'معادن ومواد مركبة وخطرة', v: 3, c: '#60a5fa' },
];

const SectionTitle = ({ kicker, children }) => (
  <div className="lp-head"><span>{tr(kicker)}</span><h2>{tr(children)}</h2></div>
);

const CycleArt = () => {
  const polar = (a, r = 70) => [100 + r * Math.cos((a * Math.PI) / 180), 100 + r * Math.sin((a * Math.PI) / 180)];
  const cols = ['#e11d48', '#2563eb', '#16a34a'];
  return (
    <svg viewBox="0 0 200 200" className="lp-cycle" aria-hidden="true">
      <circle cx="100" cy="100" r="96" fill="#ecfdf5" />
      <circle cx="100" cy="100" r="52" fill="#fff" />
      <g className="lp-cycle-spin">
        {cols.map((c, k) => {
          const st = -90 + 120 * k;
          const [x1, y1] = polar(st + 8);
          const [x2, y2] = polar(st + 96);
          const [a1x, a1y] = polar(st + 96, 55);
          const [a2x, a2y] = polar(st + 96, 85);
          const [tx, ty] = polar(st + 116);
          return (
            <g key={c}>
              <path d={`M${x1} ${y1} A70 70 0 0 1 ${x2} ${y2}`} stroke={c} strokeWidth="15" strokeLinecap="round" fill="none" />
              <polygon points={`${a1x},${a1y} ${a2x},${a2y} ${tx},${ty}`} fill={c} stroke={c} strokeWidth="3" strokeLinejoin="round" />
            </g>
          );
        })}
      </g>
      <text x="100" y="111" textAnchor="middle" fontSize="32" fontWeight="800" fill="#065f46">3R</text>
    </svg>
  );
};

const categoryStyle = {
  plastic: { Icon: Milk, c: '#e11d48' },
  paper: { Icon: Package, c: '#2563eb' },
  metal: { Icon: CupSoda, c: '#4a90d9' },
  glass: { Icon: GlassWater, c: '#0d9488' },
  organic: { Icon: Leaf, c: '#16a34a' },
  hazardous: { Icon: ShieldAlert, c: '#ea580c' },
  general: { Icon: Trash2, c: '#6b7280' },
};

const ClassificationCard = ({ data, onAsk }) => {
  const meta = categoryMeta[data.category] || categoryMeta.general;
  const { Icon, c } = categoryStyle[data.category] || categoryStyle.general;
  return (
    <div className="chat-class-card" style={{ '--c': c }}>
      <div className="chat-class-top">
        <span className="chat-class-tile"><Icon size={22} /></span>
        <div>
          <strong>{data.item}</strong>
          <span>{tr(meta.label)}</span>
        </div>
      </div>
      <div className={`chat-class-badge ${data.recyclable ? 'ok' : 'bad'}`}>
        {data.recyclable ? <Recycle size={15} /> : <XCircle size={15} />}
        {tr(data.recyclable ? 'قابلة لإعادة التدوير' : 'غير قابلة لإعادة التدوير')}
      </div>
      {data.tip && <p>{data.tip}</p>}
      {data.confidence < 0.6 && <p className="chat-class-warn">{tr('النتيجة غير مؤكدة، جرّب صورة أوضح.')}</p>}
      <button type="button" onClick={() => onAsk(LANG === 'en' ? `How do I dispose of ${data.item} properly?` : `كيف أتخلص من ${data.item} بشكل صحيح؟`)}>{tr('اسأل عن طريقة التخلص')}</button>
    </div>
  );
};

const BinArt = ({ id }) => {
  const c = BIN_COLORS[id];
  return (
    <div className="lp-bin-art">
      <svg viewBox="0 0 90 100" aria-hidden="true">
        <defs>
          <linearGradient id={`bin-${id}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor={c.a} />
            <stop offset="1" stopColor={c.b} />
          </linearGradient>
        </defs>
        <ellipse cx="45" cy="95" rx="30" ry="4" fill="#000" opacity=".12" />
        <path d="M14 26h62l-5 64a6 6 0 0 1-6 5H25a6 6 0 0 1-6-5z" fill={`url(#bin-${id})`} />
        <path d="M24 34l3 52" stroke="#fff" strokeOpacity=".25" strokeWidth="4" strokeLinecap="round" />
        <rect x="8" y="16" width="74" height="12" rx="6" fill={c.b} />
        <rect x="34" y="7" width="22" height="10" rx="5" fill={c.b} />
      </svg>
      <Recycle className="lp-bin-recycle" size={28} strokeWidth={2.4} />
    </div>
  );
};

const Donut = ({ data }) => {
  const R = 42;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <svg viewBox="0 0 120 120" className="lp-donut" role="img" aria-label="تركيبة النفايات في عمّان">
      <circle cx="60" cy="60" r={R} fill="none" stroke="#eef2f1" strokeWidth="16" />
      {data.map((d) => {
        const len = (d.v / 100) * C;
        const el = (
          <circle key={d.name} cx="60" cy="60" r={R} fill="none" stroke={d.c} strokeWidth="16"
            strokeDasharray={`${len - 1} ${C - len + 1}`} strokeDashoffset={-acc} transform="rotate(-90 60 60)" />
        );
        acc += len;
        return el;
      })}
      <text x="60" y="60" textAnchor="middle" className="lp-donut-big">50%</text>
      <text x="60" y="74" textAnchor="middle" className="lp-donut-sm">{tr('عضوية')}</text>
    </svg>
  );
};

const goldenInstructions = [
  'يجب أن يكون "نظيفاً"! اشطف العبوات البلاستيكية والمعدنية لإزالة بقايا الطعام والشراب.',
  'قم بإعادة تدوير المواد الورقية والكرتونية النظيفة والجافة فقط.',
  'لا تقم بإعادة تدوير الكرتون الذي يحمل بقع دهنية أو بقايا طعام (يمكنك إزالة الجزء المتسخ وفرز ما تبقى).',
  'لا تقم بإعادة تدوير المناديل الورقية أو الفوط المستعملة لكونها ملوثة.',
  'تأكد من وجود الرموز البيئية للمواد التي يعاد تدويرها على العبوات ومواد التغليف (مثل: PP, PET, HDPE).',
  'تخلص من النفايات الخطرة (مثل البطاريات والأدوية) في نقاط الجمع المخصصة ولا تخلطها أبداً.',
];

const CONV_KEY = 'ecowaste_conversations_v1';
const ACTIVE_KEY = 'ecowaste_active_chat';

const welcomeText =
  'مرحباً بك في EcoWasteAI 🌱\n\n' +
  'أنا مساعدك الذكي للتعرّف على ممارسات إعادة التدوير والاستدامة. اسألني عن فرز النفايات أو الاستدامة داخل الجامعة.';

const initialMessage = { id: 1, role: 'ai', text: welcomeText };

const categoryMeta = {
  plastic: { label: 'البلاستيك', icon: '♻️' },
  paper: { label: 'الورق والكرتون', icon: '📦' },
  metal: { label: 'المعادن', icon: '🥫' },
  glass: { label: 'الزجاج', icon: '🍾' },
  organic: { label: 'نفايات عضوية', icon: '🍃' },
  hazardous: { label: 'نفايات خطرة', icon: '⚠️' },
  general: { label: 'نفايات عامة', icon: '🗑️' },
};

const createChatTitle = (text) => {
  const clean = text.trim();
  return clean.length > 32 ? `${clean.slice(0, 32)}...` : clean;
};

const createConversation = () => ({
  id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  title: 'محادثة جديدة',
  messages: [initialMessage],
  updatedAt: Date.now(),
});

const isEmptyChat = (chat) => chat.messages.length <= 1;

const formatChatDate = (ts) =>
  new Date(ts).toLocaleDateString(LANG === 'en' ? 'en-US' : 'ar-JO', { day: 'numeric', month: 'short' });

const loadConversations = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(CONV_KEY));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {
    /* ignore */
  }
  // ترحيل المحادثة القديمة (إن وُجدت) إلى النظام الجديد
  try {
    const old = JSON.parse(localStorage.getItem('uni_chat_messages'));
    if (Array.isArray(old) && old.length > 1) {
      const firstUser = old.find((m) => m.role === 'user');
      return [{ ...createConversation(), title: firstUser ? createChatTitle(firstUser.text) : 'محادثة سابقة', messages: old }];
    }
  } catch {
    /* ignore */
  }
  return [createConversation()];
};

// تصغير الصورة قبل الإرسال (صور الجوال كبيرة وحد Netlify حوالي 6MB)
const resizeImage = (file, maxSize = 1024) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('bad image'));
    };
    img.src = url;
  });

const featureCards = [
  { id: 'ask', Icon: Sparkles, title: 'اسأل', page: 'assistant', text: 'اسأل الوكيل الذكي عن أي نفاية بالعربية أو الإنكليزية، واحصل على إجابة سريعة وواضحة.' },
  { id: 'learn', Icon: BookOpen, title: 'تعلّم', page: 'learn', text: 'دليل بسيط ومصوّر يشرح الفرز الصحيح لكل نوع من النفايات داخل الجامعة.' },
  { id: 'scan', Icon: Camera, title: 'صوّر', page: 'assistant', text: 'صوّر أي نفاية بكاميرا هاتفك، وسيتعرّف عليها EcoWasteAI ويخبرك أين ترميها.' },
  { id: 'impact', Icon: Recycle, title: 'الأثر', page: 'learn', text: 'فرز أنظف يعني جامعة أذكى وبيئة أنظف؛ وكل خطوة صغيرة منك تصنع فرقاً كبيراً مع الوقت.' },
];

export default function App() {
  const [lang, setLang] = useState(() => (localStorage.getItem('eco_lang') === 'en' ? 'en' : 'ar'));
  LANG = lang;
  const dir = lang === 'en' ? 'ltr' : 'rtl';

  useEffect(() => {
    localStorage.setItem('eco_lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const [initial] = useState(() => {
    const list = loadConversations();
    const saved = localStorage.getItem(ACTIVE_KEY);
    return { list, id: list.some((c) => c.id === saved) ? saved : list[0].id };
  });

  const [activePage, setActivePage] = useState('home');
  const [binTab, setBinTab] = useState('plastic');
  const [conversations, setConversations] = useState(initial.list);
  const [activeId, setActiveId] = useState(initial.id);
  const [showHistory, setShowHistory] = useState(false);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const messagesBoxRef = useRef(null);
  const chatFileRef = useRef(null);
  const [loadingText, setLoadingText] = useState('جاري البحث...');

  const activeChat = conversations.find((c) => c.id === activeId) || conversations[0];
  const messages = activeChat.messages;
  const savedChats = conversations
    .filter((c) => !isEmptyChat(c))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  useEffect(() => {
    localStorage.setItem(CONV_KEY, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, activeChat.id);
  }, [activeChat.id]);

  useEffect(() => {
    const box = messagesBoxRef.current;
    if (box) {
      box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading, activePage, activeId]);

  const updateChat = (id, updater) =>
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...updater(c), updatedAt: Date.now() } : c))
    );

  const startNewChat = () => {
    setShowHistory(false);
    if (isEmptyChat(activeChat)) return;
    const fresh = createConversation();
    setConversations((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
  };

  const openChat = (id) => {
    setActiveId(id);
    setShowHistory(false);
  };

  const deleteChat = (id) => {
    if (!window.confirm(tr('هل تريد حذف هذه المحادثة؟'))) return;
    const rest = conversations.filter((c) => c.id !== id);
    if (rest.length === 0) {
      const fresh = createConversation();
      setConversations([fresh]);
      setActiveId(fresh.id);
      return;
    }
    setConversations(rest);
    if (id === activeId) {
      setActiveId([...rest].sort((a, b) => b.updatedAt - a.updatedAt)[0].id);
    }
  };

  const sendMessage = async (messageText) => {
    if (!messageText.trim() || isLoading) return;

    const chatId = activeChat.id;
    const userMessage = { id: Date.now(), role: 'user', text: messageText };
    updateChat(chatId, (c) => ({
      ...c,
      title: isEmptyChat(c) ? createChatTitle(messageText) : c.title,
      messages: [...c.messages, userMessage],
    }));
    setInputValue('');
    setLoadingText('جاري البحث...');
    setIsLoading(true);

    let replyText;
    try {
      const response = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: LANG === 'en' ? `${messageText}\n\n(Please answer in English.)` : messageText }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.details || data.error || 'Error');

      const answer = data.answer || data.reply || data.output || data.text;
      replyText = answer || 'لم تصل إجابة من الخادم.';
    } catch (error) {
      replyText = 'الخادم غير متاح حالياً، حاول لاحقاً.';
    }

    updateChat(chatId, (c) => ({
      ...c,
      messages: [...c.messages, { id: Date.now() + 1, role: 'ai', text: replyText }],
    }));
    setIsLoading(false);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const navigateTo = (page) => {
    setActivePage(page === 'learn' ? 'learn' : page === 'home' ? 'home' : 'assistant');
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sendImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isLoading) return;

    const chatId = activeChat.id;
    setLoadingText('جاري تحليل الصورة...');
    setIsLoading(true);

    let image;
    let thumb;
    try {
      image = await resizeImage(file);
      thumb = `data:image/jpeg;base64,${await resizeImage(file, 220)}`;
    } catch (error) {
      setIsLoading(false);
      return;
    }

    updateChat(chatId, (c) => ({
      ...c,
      title: isEmptyChat(c) ? 'تصنيف صورة نفاية' : c.title,
      messages: [...c.messages, { id: Date.now(), role: 'user', text: '', image: thumb }],
    }));

    let reply;
    try {
      const response = await fetch('/.netlify/functions/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, mimeType: 'image/jpeg' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error');
      reply = data.is_waste === false
        ? { text: 'لم أتعرّف على نفاية في الصورة. جرّب صورة أوضح وأقرب للعنصر.' }
        : { text: '', classification: data };
    } catch (error) {
      reply = { text: 'تعذّر تحليل الصورة حالياً، حاول مرة أخرى.' };
    }

    updateChat(chatId, (c) => ({
      ...c,
      messages: [...c.messages, { id: Date.now() + 1, role: 'ai', ...reply }],
    }));
    setIsLoading(false);
    setLoadingText('جاري البحث...');
  };

  const isOnlyWelcome =
    messages.length === 1 &&
    messages[0].role === 'ai' &&
    messages[0].text === welcomeText;

  return (
    <div className={`site ${activePage === 'assistant' ? 'is-assistant' : ''} ${activePage === 'home' ? 'is-home' : ''}`} dir={dir}>
      {/* NAVBAR: لوجو + اللغة + قائمة الصفحات */}
      <header className="navbar">
        <div className="nav-inner">
          <button className="brand" type="button" onClick={() => navigateTo('home')}>
            <img src="/logo.png" alt="EcoWasteAI" className="brand-logo" />
          </button>

          <div className="nav-actions">
            <label className="lang-select-wrap">
              <Globe size={16} />
              <select className="lang-select" value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
              <ChevronDown size={15} />
            </label>
            <button className="mobile-menu-btn" type="button" aria-label="Menu" onClick={() => setMobileMenuOpen((prev) => !prev)}>
              {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
            {mobileMenuOpen && (
              <>
                <div className="menu-backdrop" onClick={() => setMobileMenuOpen(false)} />
                <div className="menu-panel">
                  <button type="button" className={activePage === 'home' ? 'active' : ''} onClick={() => navigateTo('home')}>{tr('الرئيسية')}</button>
                  <button type="button" className={activePage === 'assistant' ? 'active' : ''} onClick={() => navigateTo('assistant')}>{tr('المساعد')}</button>
                  <button type="button" className={activePage === 'learn' ? 'active' : ''} onClick={() => navigateTo('learn')}>{tr('تعلّم')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HOME: البانر + كبستين */}
      {activePage === 'home' && (
        <main className="page home-page">
          <div className="home-hero">
            <div className="hero-first">
              <div className="hero-logo" role="img" aria-label="EcoWasteAI" />
              <div className="hero-cta">
                <button type="button" className="hero-btn primary" onClick={() => navigateTo('assistant')}><Sparkles size={18} /> {tr('اسأل الوكيل')}</button>
                <button type="button" className="hero-btn light" onClick={() => navigateTo('learn')}><BookOpen size={18} /> {tr('تعلّم')}</button>
              </div>
            </div>
            <div className="hero-students" aria-hidden="true" />
          </div>

          <section className="fc-sec">
            <div className="fc-grid">
              {featureCards.map(({ id, Icon, title, text, page }) => (
                <button key={id} type="button" className="fc-card" onClick={() => navigateTo(page)}>
                  <span className="fc-badge">
                    <Icon size={34} strokeWidth={2} />
                    <span className="fc-leaf"><Leaf size={13} strokeWidth={2.4} /></span>
                  </span>
                  <h3 className="fc-title">{tr(title)}</h3>
                  <p className="fc-body">{tr(text)}</p>
                </button>
              ))}
            </div>
          </section>

          <JordanUniversityMap
            onAskAI={({ question }) => {
              navigateTo('assistant');
              sendMessage(question);
            }}
          />

          <section className="about-sec">
            <div className="about-grid">
              <div className="about-img-wrap">
                <div className="about-img">
                  <img src="/about.png" alt="EcoWasteAI" />
                </div>
              </div>
              <div className="about-card" dir={dir}>
                <span className="about-pill">{tr('عن EcoWasteAI')}</span>
                <h2>{tr('مساعد ذكي لتعليم إعادة التدوير داخل الجامعة')}</h2>
                <p>{tr('EcoWasteAI مساعد ذكي يساعد طلاب الجامعة على فهم إعادة التدوير والفرز الصحيح للنفايات، ومعرفة الحاوية المناسبة لكل نوع، من خلال المحادثة أو تصوير النفاية.')}</p>
                <p>{tr('صُمم ليكون بسيطاً وقريباً من الناس: اسأل بالعربية أو الإنكليزية، أو صوّر أي نفاية ليخبرك الوكيل أين ترميها وكيف تجهّزها.')}</p>
                <p>{tr('فكرتنا أن الاستدامة تبدأ بخطوة صغيرة: وعي أكبر، فرز أنظف، وجامعة أذكى وبيئة أنظف.')}</p>
                <button type="button" className="about-btn" onClick={() => navigateTo('assistant')}>{tr('تعرّف على المساعد')}</button>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ASSISTANT */}
      {activePage === 'assistant' && (
        <main className={`page assistant-page ${isOnlyWelcome ? 'welcome-mode' : ''}`}>
          <img src="/hero.jpg" alt="" className="assistant-bg" />

          {showHistory && <div className="history-overlay" onClick={() => setShowHistory(false)} />}
          <aside className={`chat-sidebar ${showHistory ? 'open' : ''}`} dir={dir}>
            <div className="sidebar-top">
              <div className="sidebar-logo"><img src="/logo.png" alt="EcoWasteAI" /></div>
              <button type="button" className="chat-head-btn sidebar-close" onClick={() => setShowHistory(false)} aria-label="close"><X size={18} /></button>
            </div>
            <button type="button" className="sidebar-new" onClick={startNewChat}><Plus size={17} /> {tr('محادثة جديدة')}</button>
            <div className="sidebar-title">{tr('محادثاتي')}</div>
            <div className="chat-history">
              {savedChats.length === 0 ? (
                <p className="chat-history-empty">{tr('لا توجد محادثات محفوظة بعد.')}</p>
              ) : (
                savedChats.map((chat) => (
                  <div key={chat.id} className={`chat-history-item ${chat.id === activeId ? 'current' : ''}`}>
                    <button type="button" className="chat-history-open" onClick={() => openChat(chat.id)}>
                      <span className="chat-history-name">{tr(chat.title)}</span>
                      <span className="chat-history-date">{formatChatDate(chat.updatedAt)}</span>
                    </button>
                    <button type="button" className="chat-history-delete" onClick={() => deleteChat(chat.id)} aria-label={tr('حذف المحادثة')}><Trash2 size={16} /></button>
                  </div>
                ))
              )}
            </div>
            <div className="sidebar-links">
              {SIDE_LINKS.map((l) => (
                <a key={l.href} className="sidebar-link" href={l.href} target="_blank" rel="noreferrer">
                  <span><strong>{tr(l.title)}</strong><small>{tr(l.desc)}</small></span>
                  <ExternalLink size={14} />
                </a>
              ))}
            </div>
          </aside>

          <section dir={dir} className={`assistant-main ${isOnlyWelcome ? 'is-welcome' : ''}`}>
            <div className="assistant-toolbar">
              <button type="button" className="tool-btn only-mobile" onClick={() => setShowHistory(true)}><History size={16} /> {tr('المحادثات')}</button>
              <button type="button" className="tool-btn only-mobile" onClick={startNewChat}><Plus size={16} /> {tr('محادثة جديدة')}</button>
            </div>

            {isOnlyWelcome ? (
              <div className="assistant-welcome">
                <span className="hero-small-title">{tr('الاستدامة تبدأ بخطوة')}</span>
                <h1>{tr('خطوة صغيرة،')}<br /><span>{tr('أثر كبير.')}</span></h1>
                <p>{tr('اسألني عن إعادة التدوير والفرز، أو صوّر أي نفاية وأخبرك أين ترميها.')}</p>
              </div>
            ) : (
              <div className="assistant-messages" ref={messagesBoxRef}>
                {messages.map((msg) => (
                  <div key={msg.id} className={`chat-message ${msg.role === 'user' ? 'chat-user' : 'chat-ai'}`}>
                    {msg.role === 'ai' ? (
                      msg.classification ? (
                        <ClassificationCard data={msg.classification} onAsk={sendMessage} />
                      ) : (
                        <div className="markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{tr(msg.text)}</ReactMarkdown>
                        </div>
                      )
                    ) : (
                      <div className="user-message-text">
                        {msg.image && <img src={msg.image} alt="الصورة المرسلة" className="chat-msg-image" />}
                        {msg.text}
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="chat-message chat-ai loading-message">
                    <span></span><span></span><span></span>
                    <span className="loading-text">{tr(loadingText)}</span>
                  </div>
                )}
              </div>
            )}

            <form className="assistant-input" onSubmit={handleSendMessage}>
              <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder={tr('اكتب سؤالك هنا...')} disabled={isLoading} />
              <input ref={chatFileRef} type="file" accept="image/*" hidden onChange={sendImage} />
              <button type="button" className="chat-camera-btn" onClick={() => chatFileRef.current?.click()} disabled={isLoading} aria-label="أرسل صورة نفاية"><Camera size={19} /></button>
              <button type="submit" aria-label="إرسال" disabled={isLoading || !inputValue.trim()}><ArrowUp size={19} /></button>
            </form>

            {isOnlyWelcome && (
              <div className="suggested-questions">
                <button type="button" onClick={() => sendMessage(tr('كيف يمكن فرز النفايات داخل الجامعة؟'))}>{tr('كيف أفرز النفايات؟')}</button>
                <button type="button" onClick={() => sendMessage(tr('ما أهمية إعادة التدوير؟'))}>{tr('لماذا نعيد التدوير؟')}</button>
                <button type="button" onClick={() => sendMessage(tr('هل علبة البيتزا الدهنية تُعاد تدويرها؟'))}>{tr('هل علبة البيتزا تُعاد تدويرها؟')}</button>
                <button type="button" onClick={() => chatFileRef.current?.click()}><Camera size={14} /> {tr('صوّر نفاية')}</button>
              </div>
            )}
          </section>
        </main>
      )}

      {/* LEARN PAGE */}
      {activePage === 'learn' && (
        <main className="page learn-page">
          {/* HERO */}
          <section className="lw-hero">
            <div className="lw-wrap lw-hero-grid">
              <div className="lw-hero-text">
                <h1>
                  <span className="lw-chip">{tr('فرز أنظف')}</span>
                  <span className="lw-chip lime">{tr('أثر أكبر')}</span>
                </h1>
                <p className="lw-sub">{tr('تعلّم كيف تقلّل، وتعيد الاستخدام، وتفرز نفاياتك بالشكل الصحيح.')}</p>
                <div className="lw-actions">
                  <button type="button" className="lw-btn" onClick={() => navigateTo('assistant')}><Sparkles size={17} /> {tr('اسأل الوكيل')}</button>
                  <a className="lw-link" href="#lw-guide">{tr('ابدأ الدليل')} <ChevronDown size={16} /></a>
                </div>
              </div>
              <div className="lw-hero-img" role="img" aria-label="EcoWasteAI" />
            </div>
          </section>

          {/* دليل الفرز (صورة + نص) */}
          <section className="lw-split" id="lw-guide">
            <a className="lw-split-img" href="/guide.jpg" target="_blank" rel="noopener noreferrer" title={tr('اضغط لعرض الدليل كاملاً')}>
              <img src="/guide.jpg" alt={tr('دليل الفرز')} />
              <span className="lw-zoom-hint"><ZoomIn size={14} aria-hidden="true" /> {tr('اضغط للتكبير')}</span>
            </a>
            <div className="lw-split-text" dir={dir}>
              <div className="lw-seal"><Recycle size={44} /></div>
              <div className="lw-split-body">
                <span className="lw-split-kicker">{tr('دليل الفرز')}</span>
                <h2>{tr('لا تخلط النفايات وتلوّثها، أعد التدوير بشكل صحيح')}</h2>
                <p>{tr('صُمم هذا الدليل لمساعدتك على معرفة الحاوية الصحيحة لكل نوع من النفايات في الجامعة: بلاستيك، معدن، زجاج، وورق وكرتون.')}</p>
                <p>{tr('قبل الرمي، فرّغ العبوة واشطفها، وافرد الكرتون. النفايات النظيفة والجافة فقط هي التي يُعاد تدويرها.')}</p>
              </div>
              <div className="lw-split-actions">
                <button type="button" className="lw-pill" onClick={() => navigateTo('assistant')}>{tr('اسأل الوكيل')}</button>
                <a className="lw-round" href="/guide.jpg" download="recycling-guide.jpg" aria-label={tr('تحميل الدليل')} title={tr('تحميل الدليل')}><Download size={18} /></a>
              </div>
            </div>
          </section>

          {/* LEARNING GAME */}
          <SortingGame lang={lang} />
        </main>
      )}
    </div>
  );
}