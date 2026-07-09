Deno.serve(async (_req) => {
  const key = Deno.env.get("GROQ_API_KEY")
  if (!key) {
    return new Response(JSON.stringify({ error: "GROQ_API_KEY not found in env" }), { status: 500 })
  }
  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: "Say hello in Uzbek. Return JSON: {\"greeting\": \"...\"}" }],
        max_tokens: 100,
      }),
    })
    const data = await resp.json()
    return new Response(JSON.stringify({ ok: resp.ok, status: resp.status, data }))
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 })
  }
})
