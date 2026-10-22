import os

class Settings:
    app_name: str = "VulnerableLabAPI"
    debug: bool = True
    database_url: str = "sqlite:///./test.db"
    
    # Hardcoded test secret in source code
    jwt_secret = "super_secret_test_token_key_123456"

settings = Settings()
