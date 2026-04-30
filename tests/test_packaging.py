"""Smoke tests guarding the PyPI wheel contract.

These tests verify that the bundled SPA build is shipped with the
package (otherwise ``gispulse portal`` would mount an empty
``StaticFiles`` directory at runtime, which is the most common
silent-bug failure mode for this kind of "carrier" package).
"""

from __future__ import annotations

from pathlib import Path

import pytest


def test_package_imports() -> None:
    """The package must be importable without side effects."""
    import gispulse_portal  # noqa: F401


def test_version_is_pep440_string() -> None:
    """``__version__`` must be a non-empty string usable by setuptools."""
    from gispulse_portal import __version__

    assert isinstance(__version__, str)
    assert __version__
    # crude PEP440 sanity (digits + dots, optional pre/post/dev)
    assert __version__[0].isdigit(), f"unexpected version prefix: {__version__!r}"


def test_portal_dist_path_exists() -> None:
    """The bundled ``dist/`` directory must be shipped with the wheel.

    This is the critical contract: if this fails post-install, the
    ``release.yml`` workflow forgot to run ``pnpm build`` and copy
    the result into ``gispulse_portal/dist`` before ``python -m build``.
    """
    from gispulse_portal import PORTAL_DIST_PATH

    assert isinstance(PORTAL_DIST_PATH, Path)
    if not PORTAL_DIST_PATH.is_dir():
        pytest.fail(
            f"Bundled SPA build is missing at {PORTAL_DIST_PATH!s}. "
            "Run `pnpm build && cp -r dist gispulse_portal/dist` "
            "before `python -m build`."
        )


def test_portal_dist_contains_index_html() -> None:
    """The SPA entrypoint must be present (``index.html`` is mandatory
    for ``StaticFiles(html=True)``)."""
    from gispulse_portal import PORTAL_DIST_PATH

    index = PORTAL_DIST_PATH / "index.html"
    if not index.is_file():
        pytest.fail(
            f"index.html not found in {PORTAL_DIST_PATH!s}. "
            "The SPA build is incomplete or the wrong directory was packaged."
        )


def test_portal_dist_contains_assets() -> None:
    """A non-trivial SPA build must ship at least one JS/CSS asset.

    Defends against shipping an empty dist/ that has only ``index.html``.
    """
    from gispulse_portal import PORTAL_DIST_PATH

    assets_dir = PORTAL_DIST_PATH / "assets"
    if not assets_dir.is_dir():
        pytest.fail(f"assets/ directory missing in {PORTAL_DIST_PATH!s}")

    # At least one .js file (rolldown/rollup output)
    js_files = list(assets_dir.glob("*.js"))
    assert js_files, f"no .js bundles found in {assets_dir!s}"
