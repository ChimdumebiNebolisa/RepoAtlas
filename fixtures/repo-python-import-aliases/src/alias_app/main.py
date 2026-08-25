import alias_app.config as app_config
from alias_app import models as domain_models
from alias_app.services import build_record as make_record
from .helpers import (
    format_value as render_value,
    normalize as normalize_value,
)
from . import config as local_config

# import alias_app.false_comment as ignored_comment
IMPORT_EXAMPLE = "from alias_app.false_string import ignored_string as fake"


def main() -> None:
    record = make_record(normalize_value(" value "))
    print(render_value(record.value))
    print(domain_models.Record(app_config.DEFAULT_PREFIX))
    print(local_config.DEFAULT_PREFIX)
