"""GISPulse Portal — bundled SPA for offline / same-origin local serving.

This package ships the pre-built VitePress / Vite SPA (the ``dist/``
directory at install time) so that the ``gispulse`` CLI can mount it
via FastAPI ``StaticFiles`` on ``localhost`` without depending on a
live network deployment.

Usage from ``gispulse``::

    from gispulse_portal import PORTAL_DIST_PATH
    app.mount("/portal", StaticFiles(directory=str(PORTAL_DIST_PATH), html=True))

The package contains no runtime logic — it is a pure assets carrier.
The version is kept in lockstep with the git tag and the upstream
``gispulse`` runtime via :data:`__version__`.
"""

from __future__ import annotations

from importlib.resources import files
from pathlib import Path

__all__ = ["PORTAL_DIST_PATH", "__version__"]

# Single source of truth for the package version. Bumped by the
# release workflow before ``python -m build`` runs (see
# ``.github/workflows/release.yml``).
__version__ = "1.5.1"


def _resolve_dist_path() -> Path:
    """Return the on-disk path to the bundled SPA build.

    Uses :func:`importlib.resources.files` so the lookup works both
    when the package is installed as a wheel (zip-safe-friendly) and
    when running from a source checkout.
    """
    resource = files(__name__).joinpath("dist")
    # ``files()`` returns a Traversable. For ``StaticFiles`` we need
    # a real filesystem path; both wheels and editable installs of
    # this package satisfy that since ``dist/`` is shipped as
    # package_data.
    return Path(str(resource))


PORTAL_DIST_PATH: Path = _resolve_dist_path()
