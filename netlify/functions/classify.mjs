// netlify/functions/classify.mjs
// يستقبل صورة (base64) ويرجع تصنيف النفاية كـ JSON.
// يستخدم GEMINI_API_KEY الموجود عندك أصلاً في Netlify.
// لتغيير الموديل بدون تعديل الكود: أضف متغير GEMINI_VISION_MODEL في Netlify.

const MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-flash-latest';

const PROMPT = `أنت نظام تصنيف نفايات لتطبيق EcoWasteAI في الجامعات الأردنية.
حلّل الصورة وحدد العنصر الرئيسي فيها وأجب بـ JSON فقط.

قواعد الفرز المعتمدة:
- البلاستيك: العبوات النظيفة وأغطيتها وعبوات المنظفات الفارغة تُعاد تدويرها. البوليسترين/الفوم وأكياس الشيبس والحلويات والأكياس المتسخة لا تُعاد.
- الورق والكرتون: النظيف والجاف فقط. المناديل الورقية والكرتون الدهني أو الملوث بالطعام (مثل علب البيتزا) لا يُعاد.
- المعادن: علب المشروبات والطعام النظيفة تُعاد. المتسخة بالزيوت أو المواد الخطرة لا.
- النفايات الخطرة (بطاريات، أدوية، إلخ) تذهب لنقاط جمع مخصصة ولا تُخلط أبداً.

الحقول:
- is_waste: هل في الصورة عنصر يمكن اعتباره نفاية؟ (false إذا الصورة لشخص أو مكان أو شيء غير واضح)
- item: اسم العنصر بالعربية باختصار (مثال: عبوة مياه بلاستيكية)
- category: plastic | paper | metal | glass | organic | hazardous | general
- recyclable: هل يُعاد تدويره بحالته الظاهرة في الصورة؟
- tip: نصيحة عملية قصيرة بالعربية (جملة أو جملتان) عن كيفية التخلص منه
- confidence: رقم من 0 إلى 1 يعبّر عن ثقتك

لا تخمّن: إذا الصورة غير واضحة اجعل confidence منخفضة.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    is_waste: { type: 'BOOLEAN' },
    item: { type: 'STRING' },
    category: {
      type: 'STRING',
      enum: ['plastic', 'paper', 'metal', 'glass', 'organic', 'hazardous', 'general'],
    },
    recyclable: { type: 'BOOLEAN' },
    tip: { type: 'STRING' },
    confidence: { type: 'NUMBER' },
  },
  required: ['is_waste', 'item', 'category', 'recyclable', 'tip', 'confidence'],
};

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const { image, mimeType } = JSON.parse(event.body || '{}');
    if (!image) return json(400, { error: 'No image provided' });

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: mimeType || 'image/jpeg', data: image } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: SCHEMA,
          },
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      console.error('Gemini error:', JSON.stringify(data));
      return json(502, { error: 'Classification failed', details: data?.error?.message });
    }

    const text = data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
    if (!text) return json(502, { error: 'Empty response from model' });

    return json(200, JSON.parse(text));
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Server error', details: err.message });
  }
};
