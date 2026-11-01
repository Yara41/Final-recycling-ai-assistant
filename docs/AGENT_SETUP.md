# دليل تشغيل إيجنت EcoWasteAI (المرحلة 1) — مجاناً

هذا الدليل يشرح كيف تشغّلين النسخة الجديدة (الإيجنت) على مشروع Supabase الحالي
`uwxksbwlzjrjlccbdjtk` بدون دفع أي شيء. نفّذي الخطوات بالترتيب.

> ⚠️ الخطوات 2–4 تغيّر قاعدة البيانات الحقيقية. الموقع الحالي (الشات القديم) يبقى يعمل،
> لأن الجداول الجديدة لا تلمس جدول `documents` إلا بإضافة عمود اختياري واحد.

---

## 0) ما الذي يحتاجه الإيجنت؟

| الخدمة | الاستخدام | التكلفة |
|---|---|---|
| Supabase Free | قاعدة البيانات، الدخول، Edge Functions، pg_cron | مجاني |
| Gemini API (Google AI Studio) | الإيجنت، تصنيف الصور، التحليل الأسبوعي | الخطة المجانية |
| Netlify Free | استضافة الموقع | مجاني (نشر يدوي فقط عند الحاجة) |

---

## 1) فعّلي الدخول المجهول (Anonymous sign-ins)

Supabase Dashboard ← **Authentication** ← **Sign In / Providers** ← فعّلي **Allow anonymous sign-ins** ← Save.

هذا يسمح للطلاب والموظفين بالبدء فوراً بدون حساب.

---

## 2) تأكدي من شكل جدول المعرفة `documents`

في **SQL Editor** شغّلي:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'documents';
```

يجب أن ترَي عمودين باسم `content` و `embedding`. إذا كانت الأسماء مختلفة، توقفي وأخبريني قبل الخطوة 3.

---

## 3) طبّقي قاعدة البيانات الجديدة + الجامعة التجريبية

في **SQL Editor**:

1. افتحي الملف `supabase/migrations/20261031120000_campus_agent.sql`، انسخي كل محتواه، الصقيه، ثم **Run**.
2. افتحي الملف `supabase/seed/demo_university.sql`، انسخيه، الصقيه، ثم **Run**.

الآن عندك جامعة تجريبية اسمها **EcoWaste Demo University** فيها بيانات 3 أسابيع (126 عملية تدوير)
وقصة واضحة للعرض: كلية الهندسة ترمي أكياس الشيبس في حاوية البلاستيك.

أكواد الدعوة التجريبية:

| الكود | الدور |
|---|---|
| `DEMO-FACILITIES` | فريق المرافق |
| `DEMO-ADMIN` | مكتب الاستدامة |

> قبل إشراك جامعة حقيقية، أنشئي أكواداً جديدة واحذفي التجريبية (انظري القسم 9).

---

## 4) سرّ التقرير الأسبوعي (تلقائي)

لا تحتاجين شيئاً هنا: الملف `supabase/migrations/20261031120050_cron_secret.sql` يولّد كلمة سر عشوائية
داخل قاعدة البيانات ويحفظها في Vault المشفّر، والدالة `insights` تتحقق منها عبر قاعدة البيانات.
شغّليه في **SQL Editor** بعد ملف الخطوة 3.

---

## 5) انشري الدوال (Edge Functions)

من Terminal داخل VS Code في مجلد المشروع:

```bash
npx supabase login
```

```bash
npm run supabase:deploy
```

هذا ينشر 4 دوال: `chat` و `classify` (القديمة) و `agent` و `insights` (الجديدة).
دالة `insights` تُنشر بدون تحقق JWT لأنها تتحقق من سرّ Vault عبر قاعدة البيانات (مضبوط في `supabase/config.toml`).

---

## 6) فعّلي التقرير الأسبوعي التلقائي

في **SQL Editor** انسخي محتوى `supabase/migrations/20261031120100_weekly_insights_cron.sql` والصقيه و **Run**.
من الآن، كل يوم اثنين الساعة 06:17 (UTC) يحلّل الإيجنت بيانات كل جامعة ويكتب تقريراً بثلاث توصيات.

لتجربته فوراً بدل انتظار الاثنين:

```sql
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'insights_url'),
  headers := jsonb_build_object('Content-Type', 'application/json',
    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
  body := '{}'::jsonb
);
```

بعد دقيقة: `select report from insights order by created_at desc limit 1;`

---

## 7) شغّلي الموقع على جهازك (بدون أي كريدت)

أنشئي ملف `.env.local` في جذر المشروع (لا يُرفع إلى GitHub):

```
VITE_SUPABASE_URL=https://uwxksbwlzjrjlccbdjtk.supabase.co
VITE_SUPABASE_ANON_KEY=<legacy anon key من Project Settings → API Keys → Legacy API keys>
```

ثم:

```bash
npm install
```

```bash
npm run dev
```

افتحي `http://localhost:5173` ← **اسأل الوكيل** ← اختاري الجامعة التجريبية والدور ← جرّبي:
«رميت عبوة ماء في حاوية البلاستيك»، أو أرسلي صورة، أو «وين أرمي البطاريات؟».

---

## 8) حسابات فريق الجامعة (المرافق ومكتب الاستدامة)

1. Dashboard ← **Authentication** ← **Users** ← **Add user** ← بريد + كلمة سر ← فعّلي **Auto Confirm User**.
2. في الموقع: **اسأل الوكيل** ← «أنا من فريق المرافق أو مكتب الاستدامة» ← دخول بالبريد وكلمة السر.
3. أدخلي كود الدعوة (`DEMO-ADMIN` أو `DEMO-FACILITIES`).

مكتب الاستدامة يرى تبويب **لوحة الجامعة**، والمرافق يرون **البلاغات**.

---

## 9) إضافة جامعة حقيقية

```sql
-- 1) الجامعة (عدّلي الحاويات والقواعد حسب الجامعة)
insert into universities (name, country, default_language, bins, sorting_rules)
values ('اسم الجامعة', 'JO', 'ar',
  '[{"id":"general","label_ar":"نفايات عامة","label_en":"General waste","color":"#6b7280","accepts":["general","organic"]},
    {"id":"plastic","label_ar":"بلاستيك","label_en":"Plastic","color":"#2563eb","accepts":["plastic"]},
    {"id":"paper","label_ar":"ورق وكرتون","label_en":"Paper & cardboard","color":"#16a34a","accepts":["paper"]},
    {"id":"metal","label_ar":"معادن","label_en":"Metals","color":"#ca8a04","accepts":["metal"]},
    {"id":"drop_off","label_ar":"نقطة تسليم خاصة","label_en":"Special drop-off point","color":"#dc2626","accepts":["glass","hazardous"]}]',
  'قواعد الفرز الخاصة بالجامعة هنا')
returning id;

-- 2) أماكن الحاويات ونقاط التسليم (كرري لكل مكان)
insert into locations (university_id, name, kind, faculty, materials)
values ('<id من الخطوة 1>', 'كافتيريا كلية الهندسة', 'bin_station', 'الهندسة', '{general,plastic,paper,metal}');

-- 3) كود دعوة لمكتب الاستدامة (غيّري الكود!)
insert into role_invites (university_id, role, code_hash, uses_left)
values ('<id>', 'admin', encode(extensions.digest('كود-سري-جديد', 'sha256'), 'hex'), 3);
```

> الكود يُكتب بأحرف كبيرة عند المقارنة: إذا كان الكود إنجليزياً اكتبيه بأحرف كبيرة داخل `digest(...)`.

لإيقاف الأكواد التجريبية: `delete from role_invites where university_id = '00000000-0000-4000-8000-000000000001';`

---

## 10) النشر على Netlify بدون صرف كريدت

1. Netlify ← الموقع ← **Project configuration** ← **Build & deploy** ← **Continuous deployment** ← **Stop builds**.
   الآن الـ push إلى GitHub لا يبني ولا يصرف كريدت.
2. عند الحاجة فقط (مثلاً قبل التحكيم) انشري يدوياً:

```bash
npm install -g netlify-cli
```

```bash
netlify login
```

```bash
netlify link
```

```bash
npm run build
```

```bash
netlify deploy --prod --dir=dist
```

كل نشر production يصرف كريدت، فانشري مرة واحدة عند اكتمال مرحلة. راقبي **Usage** في Netlify.

---

## 11) قبل التحكيم مباشرة ✅

- مشروع Supabase المجاني **يتوقف تلقائياً بعد أسبوع بدون استخدام**. افتحي الموقع واستخدميه قبل العرض بيوم، وتأكدي أن الحالة **Active** في الـ Dashboard.
- حدود Gemini المجانية: الإيجنت يستخدم 4 خطوات كحد أقصى لكل رسالة، و 30 رسالة لكل مستخدم كل 10 دقائق. إذا ظهرت رسالة «الخدمة مشغولة» انتظري دقيقة.
- أرقام الكربون **تقديرية** (معاملات تقريبية من US EPA WARM مخزّنة في جدول `impact_factors`). راجعيها قبل نشر أرقام رسمية وقولي «تقديري» في العرض.

---

## 12) الاختبارات (للتأكد أن كل شيء سليم)

```bash
npm run test:sql
```

```bash
npm run test:functions
```

```bash
npm run test:web
```

اختبارات المتصفح تحتاج بناء الموقع أولاً (مع ملف `.env.local`)، ومكتبة Playwright مع متصفح Chromium على جهازك
(مرة واحدة: `npm install --no-save playwright` ثم `npx playwright install chromium`):

```bash
npm run build && npm run test:e2e
```
