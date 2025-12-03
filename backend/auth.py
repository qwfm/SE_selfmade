import os
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from jose.exceptions import JOSEError
import httpx

from dotenv import load_dotenv

load_dotenv()

class VerifyToken:
    """Перевіряє токен Auth0"""
    def __init__(self):
        self.domain = os.getenv("AUTH0_DOMAIN")
        self.audience = os.getenv("AUTH0_API_AUDIENCE")
        self.algorithm = os.getenv("AUTH0_ALGORITHM")
        self.jwks_url = f"https://{self.domain}/.well-known/jwks.json"

    async def verify(self, token: str):
        # 1. Отримуємо публічні ключі (JWKS) від Auth0
        async with httpx.AsyncClient() as client:
            response = await client.get(self.jwks_url)
            jwks = response.json()

        # 2. Декодуємо заголовок токена
        try:
            unverified_header = jwt.get_unverified_header(token)
        except JOSEError:
            raise HTTPException(status_code=401, detail="Invalid header")

        # 3. Шукаємо правильний ключ
        rsa_key = {}
        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }
        
        if not rsa_key:
            raise HTTPException(status_code=401, detail="Unable to find appropriate key")

        # 4. Валідуємо токен
        try:
            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=[self.algorithm],
                audience=self.audience,
                issuer=f"https://{self.domain}/"
            )
            return payload # Повертає словник з даними юзера (sub, email і т.д.)
        
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token is expired")
        except jwt.JWTClaimsError:
            raise HTTPException(status_code=401, detail="Incorrect claims, check audience/issuer")
        except Exception as e:
            raise HTTPException(status_code=401, detail="Unable to parse authentication token")

# Dependency для FastAPI
token_auth_scheme = HTTPBearer()

async def get_current_user(token: HTTPAuthorizationCredentials = Depends(token_auth_scheme)):
    """Цю функцію ми будемо вставляти в ендпоінти"""
    validator = VerifyToken()
    payload = await validator.verify(token.credentials)
    return payload