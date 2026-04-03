export async function handler(event) {

  fetch('https://janita-postnodular-laurine.ngrok-free.dev/webhook/recycling-assistant', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    question: messageText
  })
});

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