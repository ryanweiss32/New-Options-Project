import os
from pathlib import Path

from dotenv import load_dotenv
from schwab.auth import easy_client


def main():
    load_dotenv()  # loads backend/apps/api/.env

    api_key = os.environ["SCHWAB_API_KEY"]
    app_secret = os.environ["SCHWAB_APP_SECRET"]
    callback_url = os.environ["SCHWAB_CALLBACK_URL"]

    token_path = Path(os.getenv("SCHWAB_TOKEN_PATH", "./.secrets/schwab_token.json"))
    token_path.parent.mkdir(parents=True, exist_ok=True)

    # Runs the Schwab login flow in your browser and saves/refreshes token_path
    client = easy_client(
        api_key=api_key,
        app_secret=app_secret,
        callback_url=callback_url,
        token_path=str(token_path),
    )

    # sanity check call
    resp = client.get_quote("SPY")
    print("Quote status:", resp.status_code)
    print(resp.json())


if __name__ == "__main__":
    main()
