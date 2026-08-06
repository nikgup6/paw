from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config.settings import settings
from app.database.connection import connect_to_mongo, close_mongo_connection
from app.routes import auth, breeds, quiz, admin, feedback, buy_requests, analytics, pets, matchmaker

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Update for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_db_client():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_mongo_connection()

@app.get("/")
async def root():
    return {"message": "Welcome to Paw Buddy API"}

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(breeds.router, prefix="/api/breeds", tags=["breeds"])
app.include_router(quiz.router, prefix="/api/quiz", tags=["quiz"])
app.include_router(pets.router, prefix="/api/pets", tags=["pets"])
app.include_router(feedback.router, prefix="/api/feedback", tags=["feedback"])
app.include_router(buy_requests.router, prefix="/api/buy", tags=["buy"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(matchmaker.router, prefix="/api/matchmaker", tags=["matchmaker"])
