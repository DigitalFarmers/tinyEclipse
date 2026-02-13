#!/usr/bin/env python3
"""Quick test: verify your Groq API key works."""

import os
import sys

# Load .env file manually
env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())

api_key = os.environ.get("GROQ_API_KEY", "")
model = os.environ.get("GROQ_CHAT_MODEL", "llama-3.3-70b-versatile")

if not api_key:
    print("❌ GROQ_API_KEY not found in .env")
    sys.exit(1)

print(f"🔑 Key: {api_key[:8]}...{api_key[-4:]}")
print(f"🤖 Model: {model}")
print(f"⏳ Testing connection...\n")

try:
    from groq import Groq

    client = Groq(api_key=api_key)
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are a helpful assistant. Reply in 1 sentence."},
            {"role": "user", "content": "Say 'TinyEclipse is online!' if you can read this."},
        ],
        temperature=0.1,
        max_tokens=50,
    )

    reply = response.choices[0].message.content
    tokens_in = response.usage.prompt_tokens
    tokens_out = response.usage.completion_tokens

    print(f"✅ Groq is working!")
    print(f"💬 Response: {reply}")
    print(f"📊 Tokens: {tokens_in} in / {tokens_out} out")
    print(f"\n🚀 Ready to deploy!")

except ImportError:
    print("❌ 'groq' package not installed. Run: pip install groq")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
