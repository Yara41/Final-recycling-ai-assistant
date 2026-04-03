export async function handler(event) {
  try {
    const body = JSON.parse(event.body);

    // 🚀 التعديل هون: غيرنا الرابط لـ uni-assistant عشان يطابق n8n
    const response = await fetch('http://13.61.19.235:5678/webhook/uni-assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: body.question,
      }),
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return {
      statusCode: response.status,
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Something went wrong',
        details: error.message,
      }),
    };
  }
}