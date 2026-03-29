// Vercel Serverless Function — AI Food Analysis
export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { imageBase64, foodName, expiryAt } = req.body;
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey)
      return res
        .status(500)
        .json({ error: "OPENROUTER_API_KEY not set in Vercel environment" });
    if (!imageBase64)
      return res.status(400).json({ error: "No image provided" });

    const mimeType = imageBase64.startsWith("data:image/png")
      ? "image/png"
      : "image/jpeg";
    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:${mimeType};base64,${imageBase64}`;

    const hoursLeft = expiryAt
      ? Math.round((new Date(expiryAt) - new Date()) / 3600000)
      : null;

    const prompt = `You are a food safety expert. Analyze this food image and provide a JSON response only (no markdown, no extra text).

Food name: ${foodName || "Unknown"}
${hoursLeft !== null ? `Expires in: ${hoursLeft} hours` : ""}

Respond with ONLY this JSON structure:
{
  "safeToEat": true or false,
  "freshnessScore": number from 1-10 (10 = perfectly fresh),
  "condition": one of "Excellent", "Good", "Fair", "Poor", "Unsafe",
  "summary": "1-2 sentence assessment of the food",
  "warnings": ["list of any concerns, empty array if none"],
  "recommendation": "Short actionable advice for the donor"
}`;

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://foodbridge.app",
          "X-Title": "FoodBridge AI Analysis",
        },
        body: JSON.stringify({
          model: "nvidia/nemotron-nano-12b-v2-vl:free",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
          max_tokens: 1500,
        }),
      },
    );

    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error?.message || `OpenRouter error: ${response.status}`,
      );

    const msg = data.choices?.[0]?.message;
    const text = (msg?.content || msg?.reasoning || "").trim();
    if (!text) throw new Error("Empty AI response");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid AI response format");

    res.status(200).json({ success: true, analysis: JSON.parse(jsonMatch[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message || "Analysis failed" });
  }
}
