# ============================================================
# pipeline/extract.py
# Responsibility: Fetch raw data from em6 free API endpoints.
# Returns raw JSON as Python dicts — no transformation here.
# ============================================================
import logging
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Logging Setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)
logger = logging.getLogger(__name__)

# ============================================================
# Constants
# ============================================================
BASE_URL = "https://api.em6.co.nz/ords/em6/data_api"
TIMEOUT  = 15  # seconds

# ============================================================
# HTTP Session with retry logic
# Retries on connection errors and 5xx server errors
# Will NOT retry on 4xx (those are our fault, not the server)
# ============================================================
def _build_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=3,
        backoff_factor=2,        # wait 2s, 4s, 8s between retries
        status_forcelist=[500, 502, 503, 504],
        allowed_methods=["GET"]
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    return session


# ============================================================
# Individual fetch functions — one per endpoint
# ============================================================

def fetch_carbon_intensity(session: requests.Session) -> dict:
    """
    Fetch current carbon intensity data.
    Endpoint: /current_carbon_intensity/
    Returns: last 3 trading periods of NZ carbon + renewable data
    """
    url = f"{BASE_URL}/current_carbon_intensity/"
    logger.info(f"Fetching carbon intensity from {url}")

    response = session.get(url, timeout=TIMEOUT)
    response.raise_for_status()

    data = response.json()
    logger.info(f"carbon_intensity: {data.get('count', 0)} records returned")
    return data

def fetch_node_prices(session: requests.Session) -> dict:
    """
    Fetch last 24hrs spot prices for 6 key nodes.
    Endpoint: /price/free_24hrs
    Returns: 288 rows (6 nodes x 48 trading periods)
    """
    url = f"{BASE_URL}/price/free_24hrs"
    logger.info(f"Fetching node prices from {url}")

    response = session.get(url, timeout=TIMEOUT)
    response.raise_for_status()

    data = response.json()
    logger.info(f"node_prices: {data.get('count', len(data.get('items', [])))} records returned")
    return data

def fetch_regional_prices(session: requests.Session) -> dict:
    """
    Fetch current spot price for all 14 NZ grid regions.
    Endpoint: /region/price/
    Returns: 14 rows (one per grid zone, current trading period)
    """
    url = f"{BASE_URL}/region/price/"
    logger.info(f"Fetching regional prices from {url}")

    response = session.get(url, timeout=TIMEOUT)
    response.raise_for_status()

    data = response.json()
    logger.info(f"regional_prices: {data.get('count', len(data.get('items', [])))} records returned")
    return data

def fetch_generation_forecast(session: requests.Session) -> dict:
    """
    Fetch wind and solar generation forecast.
    Endpoint: /ig_aggregated
    Returns: ~444 rows (SOL+WIN x NI+SI+NZ x ~74 trading periods ahead)
    """
    url = f"{BASE_URL}/ig_aggregated"
    logger.info(f"Fetching generation forecast from {url}")

    response = session.get(url, timeout=TIMEOUT)
    response.raise_for_status()

    data = response.json()
    logger.info(f"generation_forecast: {data.get('count', len(data.get('items', [])))} records returned")
    return data

def fetch_reserve_prices(session: requests.Session) -> dict:
    """
    Fetch current reserve prices for NI and SI.
    Endpoint: /current_reserve_prices/
    Returns: 2 rows (NI and SI, current trading period)
    """
    url = f"{BASE_URL}/current_reserve_prices/"
    logger.info(f"Fetching reserve prices from {url}")

    response = session.get(url, timeout=TIMEOUT)
    response.raise_for_status()

    data = response.json()
    logger.info(f"reserve_prices: {data.get('count', len(data.get('items', [])))} records returned")
    return data

# ============================================================
# Master fetch function — calls all endpoints in one go
# Used by the Prefect ingest flow
# ============================================================
def fetch_all() -> dict:
    """
    Fetch all 5 em6 free endpoints in a single session.
    Returns a dict with raw responses keyed by table name.
    """
    session = _build_session()

    logger.info("=== Starting full extract ===")

    raw = {
        "carbon_intensity":    fetch_carbon_intensity(session),
        "node_prices":         fetch_node_prices(session),
        "regional_prices":     fetch_regional_prices(session),
        "generation_forecast": fetch_generation_forecast(session),
        "reserve_prices":      fetch_reserve_prices(session),
    }

    logger.info("=== Extract complete ===")
    return raw

# ============================================================
# Quick manual test — run this file directly to verify
# Usage: python pipeline/extract.py
# ============================================================
if __name__ == "__main__":
    raw = fetch_all()
    for name, data in raw.items():
        items = data.get("items", [])
        print(f"{name:25s} → {len(items):4d} rows | "
              f"first timestamp: {items[0].get('timestamp', 'n/a') if items else 'empty'}")