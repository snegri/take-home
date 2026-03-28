import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:8000/v1",
  apiKey: "sk-alice-secret-key-123",
});

async function testVision() {
  console.log("--- Test: Vision with moondream ---");
  const response = await client.chat.completions.create({
    model: "moondream",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "What do you see in this image?" },
          {
            type: "image_url",
            image_url: {
              url: "https://picsum.photos/200/300",
            },
          },
        ],
      },
    ],
    max_tokens: 200,
  });

  console.log("Response:", response.choices[0].message.content);
  console.log("Usage:", response.usage);
  console.log("PASS\n");
}

async function main() {
  try {
    await testVision();
    console.log("Vision test passed!");
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

main();
