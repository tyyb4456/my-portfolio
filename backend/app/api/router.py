from fastapi import APIRouter

from app.api.routes import account, chat, health, prices, reports

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(chat.router)
api_router.include_router(prices.router)
api_router.include_router(reports.router)
api_router.include_router(account.router)
