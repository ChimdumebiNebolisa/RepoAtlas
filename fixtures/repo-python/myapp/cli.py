from myapp.models import get_value
from myapp import utils


def main() -> None:
    print(get_value(2))
    print(utils.helper(3))
