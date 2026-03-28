import express from "express"

const app = express()
app.use(express.json())

app.post("/v1/chat/completions", (req, res) => {
  const now = Math.floor(Date.now() / 1000)
  const model = req.body.model

  if (req.body.stream) {
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")

    res.write(
      `data: ${JSON.stringify({
        id: "chatcmpl-mock",
        object: "chat.completion.chunk",
        created: now,
        model,
        choices: [{ index: 0, delta: { role: "assistant", content: "Hi" }, finish_reason: "stop" }],
      })}\n\n`,
    )

    res.write(
      `data: ${JSON.stringify({
        id: "chatcmpl-mock",
        object: "chat.completion.chunk",
        created: now,
        model,
        choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 },
      })}\n\n`,
    )

    res.write("data: [DONE]\n\n")
    res.end()
  } else {
    res.json({
      id: "chatcmpl-mock",
      object: "chat.completion",
      created: now,
      model,
      choices: [{ index: 0, message: { role: "assistant", content: "Hi" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 },
    })
  }
})

const port = parseInt(process.env.PORT || "11435", 10)
app.listen(port, () => console.log(`Mock Ollama on :${port}`))
