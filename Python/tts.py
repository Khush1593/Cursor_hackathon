"""ElevenLabs text-to-speech → base64 MP3.

NestJS owns production TTS; this endpoint is available for Python demos
or if Backend chooses to delegate voice here later.
On any TTS failure we return null — never crash the triage path.
"""

from __future__ import annotations

import base64
from typing import Optional

from config import elevenlabs_api_key, elevenlabs_model_id, elevenlabs_voice_id


def synthesize_to_base64(text: str) -> Optional[str]:
    """Convert plain speech text to base64-encoded MP3.

    Returns None if the key is missing, text is empty, or the API call fails.
    """
    cleaned = (text or "").strip()
    if not cleaned:
        return None

    api_key = elevenlabs_api_key()
    if not api_key:
        return None

    try:
        from elevenlabs.client import ElevenLabs

        client = ElevenLabs(api_key=api_key)
        audio_iter = client.text_to_speech.convert(
            voice_id=elevenlabs_voice_id(),
            text=cleaned,
            model_id=elevenlabs_model_id(),
            output_format="mp3_44100_128",
        )
        chunks: list[bytes] = []
        for chunk in audio_iter:
            if isinstance(chunk, bytes):
                chunks.append(chunk)
            elif isinstance(chunk, (bytearray, memoryview)):
                chunks.append(bytes(chunk))
        if not chunks:
            return None
        return base64.b64encode(b"".join(chunks)).decode("ascii")
    except Exception:
        # Match Nest rule: TTS failure → null, do not crash.
        return None
