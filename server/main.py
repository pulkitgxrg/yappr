import os
import re
import time
from urllib.parse import parse_qs, urlparse

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_huggingface import HuggingFaceEmbeddings, HuggingFaceEndpoint
from langchain_pinecone import PineconeVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pinecone import Pinecone, ServerlessSpec
from pinecone.exceptions import NotFoundException
from pydantic import BaseModel, HttpUrl
from youtube_transcript_api import NoTranscriptFound, TranscriptsDisabled, YouTubeTranscriptApi

load_dotenv()

EMBEDDING_MODEL = os.getenv("HUGGINGFACE_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
CHAT_MODEL = os.getenv("HUGGINGFACE_CHAT_MODEL", "Qwen/Qwen2.5-7B-Instruct")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "yappr-transcripts")
PINECONE_CLOUD = os.getenv("PINECONE_CLOUD", "aws")
PINECONE_REGION = os.getenv("PINECONE_REGION", "us-east-1")

app = FastAPI(title="Yappr API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class IngestRequest(BaseModel):
    url: HttpUrl


class ChatRequest(BaseModel):
    video_id: str
    message: str


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


def embeddings() -> HuggingFaceEmbeddings:
    return HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)


def pinecone_client() -> Pinecone:
    api_key = os.getenv("PINECONE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="PINECONE_API_KEY is not configured on the server.")
    return Pinecone(api_key=api_key)


def pinecone_index():
    client = pinecone_client()
    embedding_dimension = len(embeddings().embed_query("dimension probe"))

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
                f"but embedding model '{EMBEDDING_MODEL}' outputs dimension {embedding_dimension}. "
                "Use an index with matching dimension or recreate this index."
            ),
        )

    return client.Index(PINECONE_INDEX)


def transcript_for(video_id: str) -> list[Document]:
    try:
        fetched = YouTubeTranscriptApi().fetch(video_id, languages=["en"])
        snippets = list(fetched)
        documents = [Document(page_content=item.text, metadata={"start": item.start, "duration": item.duration, "video_id": video_id}) for item in snippets]
    except AttributeError:
        snippets = YouTubeTranscriptApi.get_transcript(video_id, languages=["en"])
        documents = [Document(page_content=item["text"], metadata={"start": item["start"], "duration": item["duration"], "video_id": video_id}) for item in snippets]
    except (TranscriptsDisabled, NoTranscriptFound):
        raise HTTPException(status_code=422, detail="This video does not have an English transcript available.")
    return RecursiveCharacterTextSplitter(chunk_size=900, chunk_overlap=160).split_documents(documents)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/videos")
def ingest_video(payload: IngestRequest) -> dict[str, str | int]:
    video_id = extract_video_id(str(payload.url))
    chunks = transcript_for(video_id)
    index = pinecone_index()
    try:
        index.delete(delete_all=True, namespace=video_id)
    except NotFoundException:
        pass
    store = PineconeVectorStore(index=index, embedding=embeddings(), namespace=video_id)
    store.add_documents(chunks)
    return {"video_id": video_id, "status": "ready", "chunks": len(chunks)}


@app.post("/chat")
async def chat(payload: ChatRequest):
    if not os.getenv("HUGGINGFACEHUB_API_TOKEN"):
        raise HTTPException(status_code=500, detail="HUGGINGFACEHUB_API_TOKEN is not configured on the server.")

    store = PineconeVectorStore(index=pinecone_index(), embedding=embeddings(), namespace=payload.video_id)
    documents = store.similarity_search(payload.message, k=4)
    context = "\n\n".join(f"[{int(doc.metadata.get('start', 0) // 60)}:{int(doc.metadata.get('start', 0) % 60):02d}] {doc.page_content}" for doc in documents)
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You answer only from the supplied YouTube transcript. Be concise, helpful, and cite relevant timestamps in M:SS format. If the transcript does not answer, say so."),
        ("human", "Transcript excerpts:\n{context}\n\nQuestion: {question}"),
    ])
    chain = prompt | HuggingFaceEndpoint(repo_id=CHAT_MODEL, task="text-generation", max_new_tokens=450, temperature=0.3) | StrOutputParser()
    response = chain.astream({"context": context, "question": payload.message})
    return StreamingResponse(response, media_type="text/plain; charset=utf-8")
