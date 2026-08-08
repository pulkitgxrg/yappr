import json
import os
import re
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import parse_qs, urlparse

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_core.documents import Document
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pinecone import Pinecone, ServerlessSpec
from pinecone.exceptions import NotFoundException
from pydantic import BaseModel, HttpUrl
from youtube_transcript_api import (
    AgeRestricted,
    InvalidVideoId,
    IpBlocked,
    NoTranscriptFound,
    PoTokenRequired,
    RequestBlocked,
    TranscriptsDisabled,
    VideoUnavailable,
    VideoUnplayable,
    YouTubeRequestFailed,
    YouTubeTranscriptApi,
    YouTubeTranscriptApiException,
)

load_dotenv()

EMBEDDING_DIMENSIONS = int(os.getenv("OPENAI_EMBEDDING_DIMENSIONS", "1024"))

CHAT_SEARCH_K = int(os.getenv("CHAT_SEARCH_K", "6"))
CHAT_SEARCH_FETCH_K = int(os.getenv("CHAT_SEARCH_FETCH_K", "24"))
OVERVIEW_SAMPLE_SIZE = int(os.getenv("OVERVIEW_SAMPLE_SIZE", "16"))

_cached_embedding_client: OpenAIEmbeddings | None = None
_cached_embedding_dimension: int | None = None
_resolved_embedding_model: str | None = None

_video_state: dict[str, dict[str, str | int | float]] = {}
_video_locks: dict[str, threading.Lock] = {}
_video_transcript_cache: dict[str, list[Document]] = {}
_video_meta: dict[str, dict[str, str]] = {}
_state_lock = threading.Lock()
_ingest_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="yappr-ingest")
CHAT_HISTORY_LIMIT = int(os.getenv("CHAT_HISTORY_LIMIT", "12"))

app = FastAPI(title="Yappr API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class IngestRequest(BaseModel):
    url: HttpUrl | None = None
    video_id: str | None = None


class ChatTurn(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    video_id: str
    message: str
    history: list[ChatTurn] = []


def _set_video_state(video_id: str, **fields: str | int | float) -> None:
    with _state_lock:
        current = dict(_video_state.get(video_id, {}))
        current.update(fields)
        _video_state[video_id] = current


def _get_video_state(video_id: str) -> dict[str, str | int | float] | None:
    with _state_lock:
        state = _video_state.get(video_id)
        return dict(state) if state else None


def _lock_for(video_id: str) -> threading.Lock:
    with _state_lock:
        if video_id not in _video_locks:
            _video_locks[video_id] = threading.Lock()
        return _video_locks[video_id]


def _cache_transcript(video_id: str, chunks: list[Document]) -> None:
    ordered = sorted(chunks, key=lambda d: float(d.metadata.get("start", 0) or 0))
    with _state_lock:
        _video_transcript_cache[video_id] = ordered


def _get_cached_transcript(video_id: str) -> list[Document] | None:
    with _state_lock:
        chunks = _video_transcript_cache.get(video_id)
        return list(chunks) if chunks else None


def _set_video_meta(video_id: str, **fields: str) -> None:
    with _state_lock:
        current = dict(_video_meta.get(video_id, {}))
        current.update({k: v for k, v in fields.items() if v})
        _video_meta[video_id] = current


def _get_video_meta(video_id: str) -> dict[str, str]:
    with _state_lock:
        meta = _video_meta.get(video_id)
        return dict(meta) if meta else {}


def _json_unescape(value: str) -> str:
    try:
        return json.loads(f'"{value}"')
    except Exception:
        return (
            value.replace("\\n", "\n")
            .replace("\\r", "\r")
            .replace("\\t", "\t")
            .replace('\\"', '"')
            .replace("\\\\", "\\")
        )
    

def fetch_youtube_meta(video_id: str) -> dict[str, str]:
    """Fetch title + description without a YouTube Data API key (oEmbed + page)."""
    title = ""
    description = ""
    author = ""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        oembed = (
            "https://www.youtube.com/oembed"
            f"?url=https://www.youtube.com/watch?v={video_id}&format=json"
        )
        req = urllib.request.Request(oembed, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8", "ignore"))
            title = str(data.get("title") or "").strip()
            author = str(data.get("author_name") or "").strip()
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, ValueError):
        pass

    try:
        watch = f"https://www.youtube.com/watch?v={video_id}"
        req = urllib.request.Request(watch, headers=headers)
        with urllib.request.urlopen(req, timeout=12) as resp:
            html = resp.read().decode("utf-8", "ignore")

        if not title:
            m_title = re.search(r'"videoDetails":\{"videoId":"[^"]+","title":"(.*?)"', html)
            if m_title:
                title = _json_unescape(m_title.group(1)).strip()
            else:
                m_og = re.search(
                    r'<meta\s+name="title"\s+content="([^"]+)"',
                    html,
                    re.IGNORECASE,
                ) or re.search(
                    r'<meta\s+property="og:title"\s+content="([^"]+)"',
                    html,
                    re.IGNORECASE,
                )
                if m_og:
                    title = _json_unescape(m_og.group(1)).strip()

        m_desc = re.search(r'"shortDescription":"(.*?)"(?:,|})', html)
        if m_desc:
            description = _json_unescape(m_desc.group(1)).strip()
        else:
            m_og_desc = re.search(
                r'<meta\s+property="og:description"\s+content="([^"]*)"',
                html,
                re.IGNORECASE,
            ) or re.search(
                r'<meta\s+name="description"\s+content="([^"]*)"',
                html,
                re.IGNORECASE,
            )
            if m_og_desc:
                description = _json_unescape(m_og_desc.group(1)).strip()

        if not author:
            m_author = re.search(r'"ownerChannelName":"(.*?)"', html)
            if m_author:
                author = _json_unescape(m_author.group(1)).strip()
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError):
        pass

    return {
        "title": title or f"YouTube video",
        "description": description[:4000] if description else "",
        "author": author,
    }


def ensure_video_meta(video_id: str) -> dict[str, str]:
    cached = _get_video_meta(video_id)
    if cached.get("title") and cached.get("title") != "YouTube video":
        return cached
    meta = fetch_youtube_meta(video_id)
    _set_video_meta(video_id, **meta)
    return meta


def _public_status(video_id: str, state: dict | None = None) -> dict[str, str | int]:
    """Merge ingest state + video meta for API responses."""

    snap = dict(state or _get_video_state(video_id) or {})
    snap.pop("ready_at", None)
    meta = _get_video_meta(video_id)
    payload: dict[str, str | int] = {"video_id": video_id, **snap}

    if meta.get("title"):
        payload["title"] = meta["title"]
    if meta.get("description"):
        payload["description"] = meta["description"]
    if meta.get("author"):
        payload["author"] = meta["author"]
    return payload


def extract_video_id(url: str) -> str:
    parsed = urlparse(url.strip())
    host = parsed.netloc.lower()
    path_parts = [part for part in parsed.path.split("/") if part]

    if host.endswith("youtu.be") and path_parts:
        candidate = path_parts[0]
    elif "youtube.com" in host and parsed.path == "/watch":
        candidate = parse_qs(parsed.query).get("v", [""])[0]
    elif "youtube.com" in host and len(path_parts) >= 2 and path_parts[0] in {"embed", "shorts", "live", "v"}:
        candidate = path_parts[1]
    else:
        candidate = ""

    if not re.fullmatch(r"[A-Za-z0-9_-]{6,}", candidate):
        raise HTTPException(status_code=422, detail="Please provide a valid YouTube video URL.")
    return candidate


def _validate_video_id(video_id: str) -> str:
    candidate = video_id.strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{6,}", candidate):
        raise HTTPException(status_code=422, detail="Please provide a valid YouTube video id.")
    return candidate


def _openai_api_key() -> str:
    api_key = OPENAI_API_KEY or os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY is not configured on the server.",
        )
    return api_key


def _embedding_runtime() -> tuple[OpenAIEmbeddings, int, str]:
    global _cached_embedding_client, _cached_embedding_dimension, _resolved_embedding_model

    if (
        _cached_embedding_client is not None
        and _cached_embedding_dimension is not None
        and _resolved_embedding_model is not None
    ):
        return _cached_embedding_client, _cached_embedding_dimension, _resolved_embedding_model

    api_key = _openai_api_key()
    model_candidates = [
        EMBEDDING_MODEL,
        "text-embedding-3-small",
        "text-embedding-3-large",
    ]
    if EMBEDDING_DIMENSIONS in (0, 1536):
        model_candidates.append("text-embedding-ada-002")
    seen: set[str] = set()
    unique_candidates: list[str] = []
    for name in model_candidates:
        if name and name not in seen:
            seen.add(name)
            unique_candidates.append(name)

    last_error: Exception | None = None
    for model_name in unique_candidates:
        kwargs: dict = {
            "model": model_name,
            "api_key": api_key,
            "base_url": OPENAI_BASE_URL,
        }
        if "text-embedding-3" in model_name and EMBEDDING_DIMENSIONS > 0:
            kwargs["dimensions"] = EMBEDDING_DIMENSIONS

        embedding_client = OpenAIEmbeddings(**kwargs)
        try:
            embedding_dimension = len(embedding_client.embed_query("dimension probe"))
            if embedding_dimension != EMBEDDING_DIMENSIONS and "text-embedding-3" in model_name:
                raise RuntimeError(
                    f"Embedding model returned {embedding_dimension} dims, "
                    f"expected {EMBEDDING_DIMENSIONS} for index '{PINECONE_INDEX}'."
                )
            _cached_embedding_client = embedding_client
            _cached_embedding_dimension = embedding_dimension
            _resolved_embedding_model = model_name
            return embedding_client, embedding_dimension, model_name
        except Exception as exc:
            last_error = exc

    raise HTTPException(
        status_code=500,
        detail=(
            "Unable to initialize OpenAI embedding model. "
            f"Tried: {', '.join(unique_candidates)} "
            f"(target dimensions={EMBEDDING_DIMENSIONS}). "
            f"Last error: {last_error}"
        ),
    )


def embeddings() -> OpenAIEmbeddings:
    embedding_client, _, _ = _embedding_runtime()
    return embedding_client


def pinecone_client() -> Pinecone:
    api_key = os.getenv("PINECONE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="PINECONE_API_KEY is not configured on the server.")
    return Pinecone(api_key=api_key)


def pinecone_index():
    client = pinecone_client()
    _, embedding_dimension, resolved_embedding_model = _embedding_runtime()

    if not client.has_index(PINECONE_INDEX):
        client.create_index(
            name=PINECONE_INDEX,
            dimension=embedding_dimension,
            metric="cosine",
            spec=ServerlessSpec(cloud=PINECONE_CLOUD, region=PINECONE_REGION),
        )
        while not client.describe_index(PINECONE_INDEX).status["ready"]:
            time.sleep(1)

    index_description = client.describe_index(PINECONE_INDEX)
    index_dimension = getattr(index_description, "dimension", None)
    if index_dimension is None and hasattr(index_description, "to_dict"):
        index_dimension = index_description.to_dict().get("dimension")

    if index_dimension is not None and int(index_dimension) != embedding_dimension:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Pinecone index '{PINECONE_INDEX}' dimension is {index_dimension}, "
                f"but embedding model '{resolved_embedding_model}' outputs dimension {embedding_dimension}. "
                "Use an index with matching dimension or recreate this index."
            ),
        )

    return client.Index(PINECONE_INDEX)


_TRANSCRIPT_LANGS = ("en", "en-US", "en-GB", "en-IN")

_CANT_PROCESS = "Yappr can't process this video"


def _transcript_unavailable_detail(reason: str) -> str:
    return f"{_CANT_PROCESS}: {reason}"


def _snippets_to_documents(video_id: str, snippets: list) -> list[Document]:
    documents: list[Document] = []
    for item in snippets:
        if hasattr(item, "text"):
            text = (item.text or "").strip()
            start = float(getattr(item, "start", 0) or 0)
            duration = float(getattr(item, "duration", 0) or 0)
        elif isinstance(item, dict):
            text = str(item.get("text") or "").strip()
            start = float(item.get("start") or 0)
            duration = float(item.get("duration") or 0)
        else:
            continue
        if not text:
            continue
        documents.append(
            Document(
                page_content=text,
                metadata={"start": start, "duration": duration, "video_id": video_id},
            )
        )
    return documents


def _fetch_transcript_snippets(video_id: str) -> list:
    api = YouTubeTranscriptApi()

    try:
        fetched = api.fetch(video_id, languages=list(_TRANSCRIPT_LANGS))
        snippets = list(fetched)
        if snippets:
            return snippets
    except NoTranscriptFound:
        pass

    transcript_list = api.list(video_id)
    available = list(transcript_list)
    if not available:
        raise NoTranscriptFound(video_id, list(_TRANSCRIPT_LANGS), transcript_list)

    for finder in (
        transcript_list.find_manually_created_transcript,
        transcript_list.find_generated_transcript,
        transcript_list.find_transcript,
    ):
        try:
            track = finder(list(_TRANSCRIPT_LANGS))
            snippets = list(track.fetch())
            if snippets:
                return snippets
        except NoTranscriptFound:
            continue
        except Exception:
            continue

    for track in available:
        try:
            if getattr(track, "is_translatable", False):
                try:
                    track = track.translate("en")
                except Exception:
                    pass
            snippets = list(track.fetch())
            if snippets:
                return snippets
        except Exception:
            continue

    raise NoTranscriptFound(video_id, list(_TRANSCRIPT_LANGS), transcript_list)


def transcript_for(video_id: str) -> list[Document]:
    """Pull YouTube captions and chunk them for embedding. Raises HTTP 422 if unusable."""
    try:
        snippets = _fetch_transcript_snippets(video_id)
    except TranscriptsDisabled:
        raise HTTPException(
            status_code=422,
            detail=_transcript_unavailable_detail("captions are disabled on this video."),
        ) from None
    except NoTranscriptFound:
        raise HTTPException(
            status_code=422,
            detail=_transcript_unavailable_detail("no transcript/captions are available."),
        ) from None
    except InvalidVideoId:
        raise HTTPException(
            status_code=422,
            detail=_transcript_unavailable_detail("invalid YouTube video id."),
        ) from None
    except VideoUnavailable:
        raise HTTPException(
            status_code=422,
            detail=_transcript_unavailable_detail("the video is unavailable."),
        ) from None
    except VideoUnplayable:
        raise HTTPException(
            status_code=422,
            detail=_transcript_unavailable_detail("the video is unplayable."),
        ) from None
    except AgeRestricted:
        raise HTTPException(
            status_code=422,
            detail=_transcript_unavailable_detail(
                "the video is age-restricted and captions can't be fetched."
            ),
        ) from None
    except (IpBlocked, RequestBlocked, PoTokenRequired):
        raise HTTPException(
            status_code=503,
            detail=(
                "YouTube blocked transcript requests from this server "
                "(IP block or bot check). Try again later."
            ),
        ) from None
    except YouTubeRequestFailed as exc:
        raise HTTPException(
            status_code=502,
            detail=_transcript_unavailable_detail(f"YouTube request failed ({exc})."),
        ) from None
    except YouTubeTranscriptApiException as exc:
        raise HTTPException(
            status_code=422,
            detail=_transcript_unavailable_detail(
                f"couldn't retrieve a transcript ({exc.__class__.__name__})."
            ),
        ) from None
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=_transcript_unavailable_detail(f"transcript fetch failed unexpectedly ({exc})."),
        ) from None

    documents = _snippets_to_documents(video_id, snippets)
    if not documents:
        raise HTTPException(
            status_code=422,
            detail=_transcript_unavailable_detail("the transcript came back empty."),
        )

    chunks = RecursiveCharacterTextSplitter(
        chunk_size=900,
        chunk_overlap=160,
    ).split_documents(documents)
    if not chunks:
        raise HTTPException(
            status_code=422,
            detail=_transcript_unavailable_detail("couldn't build searchable chunks from the transcript."),
        )
    return chunks


def namespace_vector_count(index, namespace: str) -> int:
    stats = index.describe_index_stats()
    namespaces = stats.get("namespaces", {}) if isinstance(stats, dict) else getattr(stats, "namespaces", {})
    namespace_stats = namespaces.get(namespace, {})
    if isinstance(namespace_stats, dict):
        return int(namespace_stats.get("vector_count", 0))
    return int(getattr(namespace_stats, "vector_count", 0) or 0)


def resolve_video_id(payload: IngestRequest) -> str:
    if payload.video_id:
        return _validate_video_id(payload.video_id)
    if payload.url:
        return extract_video_id(str(payload.url))
    raise HTTPException(status_code=422, detail="Provide either a YouTube url or video_id.")


def _ingest_video_sync(video_id: str) -> None:
    lock = _lock_for(video_id)
    if not lock.acquire(blocking=False):
        return

    try:
        _set_video_state(video_id, status="processing", stage="checking")
        try:
            ensure_video_meta(video_id)
        except Exception:
            pass

        index = pinecone_index()
        existing_vectors = namespace_vector_count(index, video_id)
        if existing_vectors > 0 and _get_cached_transcript(video_id):
            _set_video_state(video_id, status="ready", stage="ready", chunks=existing_vectors)
            return

        _set_video_state(video_id, status="processing", stage="transcript")
        chunks = transcript_for(video_id)

        _set_video_state(video_id, status="processing", stage="embeddings", chunks=len(chunks))
        try:
            index.delete(delete_all=True, namespace=video_id)
        except NotFoundException:
            pass

        store = PineconeVectorStore(index=index, embedding=embeddings(), namespace=video_id)
        try:
            store.add_documents(chunks, async_req=False)
        except Exception as exc:
            message = str(exc)
            if any(
                token in message
                for token in (
                    "RateLimitError",
                    "rate_limit",
                    "429",
                    "insufficient_quota",
                    "RESOURCE_EXHAUSTED",
                )
            ):
                _set_video_state(
                    video_id,
                    status="error",
                    stage="error",
                    detail=(
                        "OpenAI embedding quota or rate limit hit. "
                        "Please retry shortly, or check your API key limits."
                    ),
                )
                return
            _set_video_state(video_id, status="error", stage="error", detail=message)
            return

        _cache_transcript(video_id, chunks)

        _set_video_state(video_id, status="ready", stage="ready", chunks=len(chunks), ready_at=time.time())
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        _set_video_state(video_id, status="error", stage="error", detail=detail)
    except Exception as exc:
        _set_video_state(video_id, status="error", stage="error", detail=str(exc))
    finally:
        lock.release()


def schedule_ingest(video_id: str) -> dict[str, str | int]:
    """Kick off (or reuse) background ingest. Returns current status snapshot."""

    if not _get_video_meta(video_id).get("title"):
        _ingest_pool.submit(ensure_video_meta, video_id)

    state = _get_video_state(video_id)
    if state and state.get("status") in ("ready", "processing"):
        return _public_status(video_id, state)

    try:
        index = pinecone_index()
        existing_vectors = namespace_vector_count(index, video_id)
        if existing_vectors > 0 and _get_cached_transcript(video_id):
            _set_video_state(video_id, status="ready", stage="ready", chunks=existing_vectors, ready_at=time.time())
            return _public_status(video_id)
    except HTTPException:
        raise
    except Exception:
        pass

    _set_video_state(video_id, status="processing", stage="queued")
    _ingest_pool.submit(_ingest_video_sync, video_id)
    return _public_status(video_id)


def _is_effectively_ready(video_id: str, state: dict | None) -> bool:
    if not state or state.get("status") != "ready":
        return False
    return True


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/videos")
def ingest_video(payload: IngestRequest) -> dict[str, str | int]:
    """Start transcript fetch + embeddings in the background; returns immediately."""
    video_id = resolve_video_id(payload)
    return schedule_ingest(video_id)


@app.get("/videos/{video_id}")
def video_status(video_id: str) -> dict[str, str | int]:
    video_id = _validate_video_id(video_id)

    if not _get_video_meta(video_id).get("title"):
        _ingest_pool.submit(ensure_video_meta, video_id)

    state = _get_video_state(video_id)
    if _is_effectively_ready(video_id, state) or (state and state.get("status") in ("processing", "error")):
        return _public_status(video_id, state)

    try:
        index = pinecone_index()
        existing_vectors = namespace_vector_count(index, video_id)
        if existing_vectors > 0:
            _set_video_state(video_id, status="ready", stage="ready", chunks=existing_vectors, ready_at=time.time())
            return _public_status(video_id)
    except Exception:
        pass

    if state:
        return _public_status(video_id, state)

    return _public_status(video_id, {"status": "unknown", "stage": "unknown"})


def chat_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=CHAT_MODEL,
        base_url=OPENAI_BASE_URL,
        api_key=_openai_api_key(),
        temperature=0.45,
        streaming=True,
    )


CHAT_SYSTEM_PROMPT = """You are Yappr — a sharp assistant that helps people understand a YouTube video.

You receive:
1) Optional prior conversation turns (chat history) — use them for continuity and follow-ups.
2) Timestamped transcript excerpts for the current question — your factual evidence about the video.
3) Optional video title/description metadata (may be incomplete).

Answer like a capable co-watcher who remembers what was already discussed.

## How to answer
- Use chat history for pronouns and follow-ups ("that part", "the second point", "what about her claim?").
- Explain in your own words. Synthesize and clarify; do not paste or re-speak the transcript line-by-line.
- Lead with a clear direct answer, then add short supporting detail when useful.
- When you reference a specific moment, cite it as M:SS (e.g. 4:32 or 1:05:12). Cite only timestamps that appear in the excerpts.
- For overviews/summaries: describe the narrative arc — what the video is about, main points in order, how it wraps up.
- Structure with short paragraphs or tight bullet lists. Light markdown is fine (bold for key terms, bullets for lists).
- Stay concise. Prefer density over filler.

## Hard rules
- Do not invent facts, quotes, names, numbers, or timestamps unsupported by the excerpts (or prior turns' established facts from excerpts).
- Do not dump long raw transcript chunks back at the user.
- Do not prefix every sentence with a timestamp.
- Avoid repetitive openers like "Based on the transcript provided…".
- If the excerpts truly do not cover the question, say so briefly — do not guess.

You are not a transcript printer. You are an explainer grounded in the transcript, with memory of this chat."""

_OVERVIEW_PATTERNS = re.compile(
    r"\b("
    r"overview|summar(y|ize|ise)|"
    r"what.{0,15}(is|was).{0,15}(video|guy|speaker|this).{0,15}(about|talking)|"
    r"what.{0,10}(this|the)\s+video\s+(about|cover)|"
    r"tl;?dr|main\s+(point|topic|idea)s?|"
    r"what\s+(does|did)\s+(he|she|they)\s+(talk|say)"
    r")\b",
    re.IGNORECASE,
)


def _is_overview_query(message: str) -> bool:
    return bool(_OVERVIEW_PATTERNS.search(message))


def _format_timestamp(seconds: float) -> str:
    total = int(seconds)
    return f"{total // 60}:{total % 60:02d}"


def _sample_evenly(chunks: list[Document], sample_size: int) -> list[Document]:
    """Evenly-spaced sample across an ordered list, always including first/last."""
    if len(chunks) <= sample_size:
        return chunks
    step = len(chunks) / sample_size
    indices = sorted({min(int(i * step), len(chunks) - 1) for i in range(sample_size)})
    return [chunks[i] for i in indices]


def _build_context(video_id: str, message: str, store: PineconeVectorStore) -> str:
    if _is_overview_query(message):
        cached = _get_cached_transcript(video_id)
        if cached:
            sampled = _sample_evenly(cached, OVERVIEW_SAMPLE_SIZE)
            return "\n\n".join(
                f"[{_format_timestamp(doc.metadata.get('start', 0))}] {doc.page_content}"
                for doc in sampled
            )

        documents = store.max_marginal_relevance_search(
            "main topic key points introduction summary of the video",
            k=OVERVIEW_SAMPLE_SIZE,
            fetch_k=OVERVIEW_SAMPLE_SIZE * 3,
        )
        documents = sorted(documents, key=lambda d: float(d.metadata.get("start", 0) or 0))
        return "\n\n".join(
            f"[{_format_timestamp(doc.metadata.get('start', 0))}] {doc.page_content}"
            for doc in documents
        )

    documents = store.max_marginal_relevance_search(
        message, k=CHAT_SEARCH_K, fetch_k=CHAT_SEARCH_FETCH_K
    )
    documents = sorted(documents, key=lambda d: float(d.metadata.get("start", 0) or 0))
    return "\n\n".join(
        f"[{_format_timestamp(doc.metadata.get('start', 0))}] {doc.page_content}"
        for doc in documents
    )


@app.post("/chat")
async def chat(payload: ChatRequest):
    video_id = _validate_video_id(payload.video_id)
    state = _get_video_state(video_id)

    index = pinecone_index()

    if _is_effectively_ready(video_id, state):
        pass
    else:
        existing_vectors = namespace_vector_count(index, video_id)
        if existing_vectors > 0:
            _set_video_state(video_id, status="ready", stage="ready", chunks=existing_vectors, ready_at=time.time())
        else:
            if state and state.get("status") == "processing":
                raise HTTPException(
                    status_code=409,
                    detail="Video is still being indexed. Please wait a moment and try again.",
                )
            if state and state.get("status") == "error":
                raise HTTPException(
                    status_code=422,
                    detail=str(state.get("detail") or "Failed to index this video."),
                )
            raise HTTPException(
                status_code=404,
                detail="Video has not been indexed yet. Open it from the home page first.",
            )

    store = PineconeVectorStore(index=index, embedding=embeddings(), namespace=video_id)
    context = _build_context(video_id, payload.message, store)
    if not context.strip():
        context = "(No transcript excerpts were retrieved for this question.)"

    meta = ensure_video_meta(video_id)
    video_label = meta.get("title") or video_id
    video_desc = (meta.get("description") or "").strip()
    if len(video_desc) > 600:
        video_desc = video_desc[:600].rstrip() + "…"

    overview = _is_overview_query(payload.message)
    task_hint = (
        "The user wants a high-level overview/summary. Weave the excerpts into a "
        "coherent explanation of what the video is about — not a quote dump. "
        "Respect prior chat turns if this is a follow-up."
        if overview
        else "Answer the user's specific question using the relevant excerpts and "
        "prior chat context. Explain clearly; cite M:SS timestamps when pointing to moments."
    )

    system_parts = [CHAT_SYSTEM_PROMPT, f"\n## Video\nTitle: {video_label}"]
    if meta.get("author"):
        system_parts.append(f"Channel: {meta['author']}")
    if video_desc:
        system_parts.append(f"Description (may be truncated):\n{video_desc}")

    llm_messages: list = [SystemMessage(content="\n".join(system_parts))]

    for turn in payload.history[-CHAT_HISTORY_LIMIT:]:
        role = (turn.role or "").lower().strip()
        content = (turn.content or "").strip()
        if not content:
            continue
        if role in {"user", "human"}:
            llm_messages.append(HumanMessage(content=content))
        elif role in {"assistant", "ai", "model"}:
            llm_messages.append(AIMessage(content=content))

    llm_messages.append(
        HumanMessage(
            content=(
                f"{task_hint}\n\n"
                "## Timestamped transcript excerpts for this turn (source of truth)\n"
                f"{context}\n\n"
                "## Current user question\n"
                f"{payload.message}\n\n"
                "Respond as Yappr: clear, grounded, and useful. "
                "Use prior turns for continuity when relevant."
            )
        )
    )

    llm = chat_llm()

    async def token_stream():
        async for chunk in llm.astream(llm_messages):
            text = chunk.content
            if not text:
                continue
            if isinstance(text, str):
                yield text
            elif isinstance(text, list):
                for block in text:
                    if isinstance(block, str):
                        yield block
                    elif isinstance(block, dict) and block.get("type") == "text":
                        yield str(block.get("text", ""))
                    elif hasattr(block, "text"):
                        yield str(block.text)

    return StreamingResponse(token_stream(), media_type="text/plain; charset=utf-8")