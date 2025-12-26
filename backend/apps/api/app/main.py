from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import market
from app.routes import strategies


app = FastAPI(title="ProTrade API")

# This lets your frontend (running at localhost:3000) call your backend (running at 127.0.0.1:8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # only allow your frontend website
    allow_credentials=True,                   # allow cookies/auth later if needed
    allow_methods=["*"],                      # allow GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],                      # allow any headers (Authorization later)
)

# Health check endpoint: use this to confirm the backend is alive
@app.get("/health")
def health():
    return {"status": "ok"}

from app.routes.market import router as market_router
app.include_router(market_router)
app.include_router(strategies.router)