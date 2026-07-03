import io

import edge_tts

# Professional English voices from Microsoft Edge TTS (free, no API key required).
# GuyNeural: authoritative male — fits a stern US consulate officer.
# JennyNeural: clear female — fits a friendly trainer.
CONSUL_VOICE = "en-US-GuyNeural"
TRAINER_VOICE = "en-US-JennyNeural"


async def text_to_speech(text: str, mode: str = "consul") -> bytes:
    voice = CONSUL_VOICE if mode == "consul" else TRAINER_VOICE
    communicate = edge_tts.Communicate(text[:4096], voice)
    buf = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])
    buf.seek(0)
    return buf.read()
