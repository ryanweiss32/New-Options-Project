from pathlib import Path
import os

from schwab.auth import client_from_token_file


def get_schwab_client():
    """
    Loads the Schwab client using the saved token file.
    Returns None if the token file doesn't exist yet.
    """
    token_path = Path(os.getenv("SCHWAB_TOKEN_PATH", "./.secrets/schwab_token.json"))

    if not token_path.exists():
        return None

    api_key = os.getenv("SCHWAB_API_KEY")
    app_secret = os.getenv("SCHWAB_APP_SECRET")

    if not api_key or not app_secret:
        return None

    return client_from_token_file(
    api_key=api_key,
    app_secret=app_secret,
    token_path=str(token_path),
    enforce_enums=False,
)
