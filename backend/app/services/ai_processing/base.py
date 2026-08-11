"""Contracts shared by every document processor.

A processor turns a raw file into an `ExtractionResult`, and tells the Health
Vault where the extracted rows belong. The vault treats all document types
through this one interface, so adding a type means writing a processor and
registering it — upload, storage, retry, delete and routing never change.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from abc import ABC, abstractmethod


@dataclass
class ExtractionResult:
    records: List[Dict[str, Any]] = field(default_factory=list)  # structured rows (e.g. vaccinations)
    confidence: float = 0.0            # overall 0..1
    summary: Optional[str] = None      # short human-readable summary
    needs_review: bool = False         # low confidence or invalid — user must confirm
    missing_fields: List[str] = field(default_factory=list)
    raw_extraction: Optional[Dict[str, Any]] = None  # structured JSON kept on the document


class DocumentProcessor(ABC):
    """Base class for all medical-document processors."""

    #: the DocumentType value this processor handles (e.g. "vaccination")
    document_type: str = ""
    #: bump when the prompt changes — recorded in ai_metadata.prompt_version
    prompt_version: str = "v1"
    #: Mongo collection the extracted rows are written to by default
    collection: str = ""
    #: whether extracted rows feed the reminder engine (vaccinations do; a
    #: prescription is a record of what was dispensed, not a future due date)
    creates_reminders: bool = False

    def collections(self) -> tuple:
        """Every collection this processor may write to. Usually just one, but a
        single document can legitimately hold more than one kind of record — an
        Indian health booklet has vaccination sections and a deworming log on
        the same page — and those are different entities, not one table with a
        type column."""
        return (self.collection,)

    def collection_for(self, record: dict) -> str:
        """Where this particular extracted record belongs."""
        return self.collection

    def supersedes(self, record: dict) -> Optional[dict]:
        """A query for rows this record REPLACES rather than sits beside.

        Most extracted rows are historical events and simply accumulate. A few
        represent a current state instead — "the next dose is owed on X" — and
        there can only be one of those at a time. Re-reading the document has to
        move that date, not stack another one next to it. Returning a filter
        (matched within the dog) makes the write an upsert."""
        return None

    @abstractmethod
    async def process(self, file_bytes: bytes, mime_type: str) -> ExtractionResult:
        ...

    @abstractmethod
    def build_row(self, record: dict, dog_id: str, document_id: str) -> dict:
        """Turn one extracted record into the document stored in its collection.
        Always stamps `dog_id` so the row can only ever be read back for its
        own dog."""

    def duplicate_key(self, record: dict) -> Optional[Tuple]:
        """Identity used to skip re-inserting a record the dog already has —
        so re-uploading the same certificate, or retrying a partly-failed scan,
        doesn't double the history. None means "never treat as a duplicate"."""
        return None
