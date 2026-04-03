export async function handler(event) {
  try {
    // 1. تحويل البيانات القادمة من الموقع لنص يمكن فهمه
    const body = JSON.parse(event.body);

    // 2. إرسال السؤال إلى n8n باستخدام رابط ngrok الخاص بكِ
    const response = await fetch('https://janita-postnodular-laurine.ngrok-free.dev/webhook/recycling-assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: body.question, // التأكد من إرسال السؤال الصحيح
      }),
    });

    // 3. استلام الرد من n8n
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    // 4. إرجاع الرد النهائي للموقع
    return {
      statusCode: response.status,
      body: JSON.stringify(data),
    };

  } catch (error) {
    // في حال حدوث أي خطأ في الاتصال
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Something went wrong',
        details: error.message,
      }),
    };
  }
}