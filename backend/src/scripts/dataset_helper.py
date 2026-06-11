"""
Shared helper for reading the active dataset config from disk.
Used by evaluate_model.py, train_and_save.py, etc.
"""

import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, '..', 'data')
CONFIG_PATH = os.path.join(DATA_DIR, 'dataset_config.json')
DEFAULT_CSV = os.path.join(SCRIPT_DIR, '..', '..', '..', 'Car details v3 (1).csv')


def read_dataset_config():
    """Read dataset_config.json. Returns dict."""
    try:
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                return json.load(f) or {}
    except Exception:
        pass
    return {}


def get_active_dataset_path():
    """Returns absolute path to the currently active dataset CSV."""
    cfg = read_dataset_config()
    active = cfg.get('active_path')
    if active and os.path.exists(active):
        return active
    return DEFAULT_CSV


def get_active_currency():
    """Returns the currency of the active dataset. Defaults to 'INR'."""
    cfg = read_dataset_config()
    active = cfg.get('active_path')
    if active and os.path.exists(active):
        return cfg.get('price_currency', 'INR')
    return 'INR'
