from alias_app.helpers import normalize as clean
from .models import Record as DomainRecord


def build_record(value: str) -> DomainRecord:
    return DomainRecord(clean(value))
