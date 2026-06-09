"""HVN-016 — backend scaffold & config."""

import os

import backend
from backend import config
from backend.config import _load_dotenv


def test_package_imports():
    assert backend.__version__


def test_tick_ms_is_positive_int():
    assert isinstance(config.TICK_MS, int)
    assert config.TICK_MS > 0


def test_has_api_key_returns_bool():
    # v1.1 runs with or without a key; the value itself is never exposed
    assert isinstance(config.has_api_key(), bool)


def test_dotenv_parser(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text('# comment\nHAVEN_FOO = "bar"\nQUUX=baz\nNOEQ\n', encoding="utf-8")
    monkeypatch.delenv("HAVEN_FOO", raising=False)
    monkeypatch.delenv("QUUX", raising=False)
    _load_dotenv(env_file)
    assert os.environ["HAVEN_FOO"] == "bar"
    assert os.environ["QUUX"] == "baz"


def test_dotenv_does_not_overwrite_existing(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("HAVEN_FOO=fromfile\n", encoding="utf-8")
    monkeypatch.setenv("HAVEN_FOO", "fromenv")
    _load_dotenv(env_file)
    assert os.environ["HAVEN_FOO"] == "fromenv"
