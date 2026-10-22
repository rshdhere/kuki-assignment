"""A small, safe arithmetic evaluator for the model's calculations.

Supports numbers, + - * / and parentheses, SUM/AVERAGE/MIN/MAX/ROUND/ABS, and
spreadsheet references such as `SUM('Monthly Summary 2026'!F3:F14)` resolved
against the selected documents' cells, so sums are exact rather than the
model's mental arithmetic.
"""

import ast
import operator
import re

from kuki_ai.grounding import cell_values
from kuki_ai.schemas import Segment

_RANGE = re.compile(
    r"(?:'([^']+)'|([A-Za-z_][\w .-]*?))!(\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?)"
)

_BINARY = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
}


def _flatten(args) -> list[float]:
    out: list[float] = []
    for a in args:
        out.extend(a if isinstance(a, list) else [a])
    return out


_FUNCS = {
    "SUM": lambda *a: sum(_flatten(a)),
    "AVERAGE": lambda *a: sum(_flatten(a)) / len(_flatten(a)),
    "MIN": lambda *a: min(_flatten(a)),
    "MAX": lambda *a: max(_flatten(a)),
    "ABS": abs,
    "ROUND": lambda x, n=0: round(x, int(n)),
}


class CalcError(ValueError):
    pass


def evaluate(expression: str, segments: list[Segment] | None = None) -> float:
    names: dict[str, float | list[float]] = {}

    def replace(match: re.Match) -> str:
        sheet = match[1] or match[2].strip()
        values = [v for v in cell_values(segments or [], sheet, match[3]) if isinstance(v, float)]
        if not values:
            raise CalcError(f"No numeric cells at {sheet}!{match[3]}")
        name = f"_r{len(names)}"
        names[name] = values if ":" in match[3] else values[0]
        return name

    source = _RANGE.sub(replace, expression)
    # Thousands separators in literals ("47,407") would parse as tuples.
    source = re.sub(r"(?<=\d),(?=\d{2,3}\b)", "", source)
    try:
        tree = ast.parse(source, mode="eval")
    except SyntaxError as err:
        raise CalcError(f"Not an arithmetic expression: {expression}") from err

    def walk(node):
        if isinstance(node, ast.Expression):
            return walk(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, int | float):
            return float(node.value)
        if isinstance(node, ast.BinOp) and type(node.op) in _BINARY:
            return _BINARY[type(node.op)](walk(node.left), walk(node.right))
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub | ast.UAdd):
            value = walk(node.operand)
            return -value if isinstance(node.op, ast.USub) else value
        if isinstance(node, ast.Name) and node.id in names:
            return names[node.id]
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id.upper() in _FUNCS
        ):
            return _FUNCS[node.func.id.upper()](*(walk(a) for a in node.args))
        raise CalcError(f"Unsupported syntax in {expression!r}")

    try:
        result = walk(tree)
    except ZeroDivisionError as err:
        raise CalcError("Division by zero") from err
    if isinstance(result, list):
        raise CalcError("A range needs a function such as SUM")
    return float(result)
