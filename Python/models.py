"""Frozen request/response contracts for the Aura triage engine.

Field names and enums are locked — do not rename without updating
Project_Instructions/contracts.md and notifying the backend developer.
"""

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class UserBaseline(BaseModel):
    age: int
    sex: str
    chronicConditions: List[str]
    currentMeds: List[str]


class RecentLog(BaseModel):
    rawAudioText: str
    detectedConditionId: Optional[str] = None
    extractedMetrics: Dict[str, Any]
    createdAt: str


class PendingTriage(BaseModel):
    condition_id: str
    turn: int


class TriageRequest(BaseModel):
    transcript: str
    baseline: UserBaseline
    recentLogs: List[RecentLog]
    recurringConditions: List[str] = Field(default_factory=list)
    pendingTriage: Optional[PendingTriage] = None


class AuraResponse(BaseModel):
    action_type: Literal[
        "ask_follow_up",
        "resolve",
        "emergency_escalation",
        "general_response",
    ]
    detected_mode: Literal["preventive", "urgent_care", "emergency"]
    detected_condition_id: Optional[str] = None
    extracted_dashboard_metrics: Dict[str, Any] = Field(default_factory=dict)
    ai_spoken_response: str
    trigger_exa_search: Optional[str] = None
    pending_triage_update: Optional[PendingTriage] = None
    # V6: explainability bullets for Nest → frontend ReasoningPanel
    reasoning_trace: List[str] = Field(default_factory=list)


class TtsRequest(BaseModel):
    """Text NestJS (or a demo client) sends for ElevenLabs TTS."""

    text: str


class TtsResponse(BaseModel):
    """Base64 MP3 for the frontend audio player. null on TTS failure."""

    audio_base64: Optional[str] = None
