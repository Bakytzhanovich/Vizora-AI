from app.services.ai_service import get_stt_client


async def speech_to_text(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    client, model = get_stt_client()
    response = await client.audio.transcriptions.create(
        model=model,
        file=(filename, audio_bytes, _mime(filename)),
        language="en",
    )
    return _clean(response.text)


# Whisper commonly hallucinates these phrases for silence/background noise.
# Includes Russian/Kazakh patterns common with whisper-large-v3-turbo.
_HALLUCINATIONS = frozenset({
    "you", "the", "thank you.", "thanks.",
    "субтитры сделаны дяде вите", "субтитры сделал dimatorzok",
    "продолжение следует", "подписывайтесь на канал",
    "спасибо за просмотр", "все права защищены",
})

# Whisper writes fluent text by default and drops "um"/"uh". A prompt written
# with fillers makes it keep them, and hesitations are exactly what the level
# test needs to hear.
_KEEP_FILLERS_PROMPT = "Umm, let me think like, hmm... Okay, here's what I'm, like, thinking."


def _clean(text: str) -> str:
    text = text.strip()
    if len(text) < 3 or text.lower() in _HALLUCINATIONS:
        return ""
    return text


def _mime(filename: str) -> str:
    if filename.endswith(".mp4"):
        return "audio/mp4"
    if filename.endswith(".wav"):
        return "audio/wav"
    return "audio/webm"


async def speech_to_text_timed(audio_bytes: bytes, filename: str = "audio.webm") -> tuple[str, list[dict]]:
    """Text plus per-word timings ({"word", "start", "end"} in seconds), with
    fillers kept. Timings are empty when the provider doesn't return them."""
    client, model = get_stt_client()
    response = await client.audio.transcriptions.create(
        model=model,
        file=(filename, audio_bytes, _mime(filename)),
        language="en",
        prompt=_KEEP_FILLERS_PROMPT,
        response_format="verbose_json",
        timestamp_granularities=["word"],
    )
    text = _clean(response.text)
    if not text:
        return "", []
    words = []
    for w in getattr(response, "words", None) or []:
        get = w.get if isinstance(w, dict) else lambda k, w=w: getattr(w, k, None)
        if get("word") is not None and get("start") is not None and get("end") is not None:
            words.append({"word": str(get("word")), "start": float(get("start")), "end": float(get("end"))})
    return text, words
