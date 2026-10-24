import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routes.api import router

app = FastAPI(
    title="Wind Forecast API",
    description="UK national wind generation: day-ahead forecasts vs actuals (Elexon BMRS, January 2026).",
)

# Comma-separated list of allowed frontend origins, e.g. "https://myapp.vercel.app".
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.exception_handler(FileNotFoundError)
def missing_data(_: Request, exc: FileNotFoundError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(router)