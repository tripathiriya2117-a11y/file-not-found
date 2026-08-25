import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

async function testGeminiMetadata() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('No GEMINI_API_KEY');
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' }
  });

  const sampleText = 'Java Chapter 1: Introduction to Variables, Primitive Data Types (int, double, boolean), and Java Virtual Machine (JVM) memory architecture including heap and stack management.';
  const prompt = `You are an AI file organizer. Analyze the following extracted PDF text and original filename.
Generate:
1. "smart_title": A clean, descriptive, human-readable filename ending in .pdf (e.g. "Java JVM Memory Architecture.pdf"). Do NOT include filesystem path separators (/ or \\), colons, asterisks, question marks, quotes, or illegal characters.
2. "summary": Exactly ONE concise sentence (max 25 words) explaining what this document is about.
3. "tags": An array of 3 to 5 concise topic tags (e.g. ["Java", "JVM", "Memory Management", "Variables"]).

Original Filename: "doc_8472.pdf"
Extracted Content:
${sampleText}

Respond ONLY with a valid JSON object matching this schema:
{
  "smart_title": string,
  "summary": string,
  "tags": string[]
}`;

  const result = await model.generateContent(prompt);
  console.log('✅ GEMINI 2.5 FLASH GENERATION RESULT:');
  console.log(result.response.text());
}

testGeminiMetadata().catch(console.error);
