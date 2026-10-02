export async function handler(event) {
  console.log("CHAT FUNCTION CALLED");
  console.log("METHOD:", event.httpMethod);
  console.log("BODY:", event.body);

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      success: true,
      message: "Netlify function is working",
      receivedBody: event.body || null,
    }),
  };
}
