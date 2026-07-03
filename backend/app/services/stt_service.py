from app.services.ai_service import get_stt_client


async def speech_to_text(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    client, model = get_stt_client()
    mime = "audio/webm"
    if filename.endswith(".mp4"):
        mime = "audio/mp4"
    elif filename.endswith(".wav"):
        mime = "audio/wav"

    response = await client.audio.transcriptions.create(
        model=model,
        file=(filename, audio_bytes, mime),
        language="en",
    )
    text = response.text.strip()
    # Whisper commonly hallucinates these phrases for silence/background noise.
    # Includes Russian/Kazakh patterns common with whisper-large-v3-turbo.
    _HALLUCINATIONS = frozenset({
        "you", "the", "thank you.", "thanks.",
        "субтитры сделаны дяде вите", "субтитры сделал dimatorzok",
        "продолжение следует", "подписывайтесь на канал",
        "спасибо за просмотр", "все права защищены",
    })
    if len(text) < 3 or text.lower() in _HALLUCINATIONS:
        return ""
    return text
