"""Offline checks for Harbor packaging and fail-closed reward output."""

import json

import pytest
import yaml

from kuki_ai.evals import harbor


def test_export_keeps_expectations_and_secrets_out_of_agent_image(tmp_path, monkeypatch):
    app = tmp_path / "app"
    (app / "src").mkdir(parents=True)
    (app / "src/runtime.py").write_text("# runtime\n")
    (app / "pyproject.toml").write_text("[project]\nname='example'\n")
    (app / ".env").write_text("OPENAI_API_KEY=never-copy-this\n")
    (app / "evals").mkdir()
    case = {
        "id": "E01",
        "question": "What is the value?",
        "documents": ["bill.pdf"],
        "expect": {"values": [{"value": 42}]},
        "source": "p.1",
    }
    (app / "evals/cases.yaml").write_text(yaml.safe_dump([case]))
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "bill.pdf").write_bytes(b"example")
    monkeypatch.setattr(harbor, "APP_DIR", app)
    tasks = tmp_path / "tasks"
    harbor.export_tasks(tasks, docs)
    task = tasks / "e01"
    request = json.loads((task / "environment/request.json").read_text())
    assert set(request) == {"id", "question", "documents"}
    assert not (task / "environment/.env").exists()
    assert not (task / "environment/evals").exists()
    assert json.loads((task / "tests/case.json").read_text()) == case
    assert (task / "tests/test.sh").stat().st_mode & 0o111
    with pytest.raises(ValueError, match="already exists"):
        harbor.export_tasks(tasks, docs)


@pytest.mark.parametrize("contents", [None, "not json", "{}"])
def test_missing_or_invalid_answer_gets_zero_reward(tmp_path, contents):
    case = tmp_path / "case.json"
    case.write_text(json.dumps({"documents": ["bill.pdf"]}))
    answer = tmp_path / "answer.json"
    if contents is not None:
        answer.write_text(contents)
    output = tmp_path / "rewards"
    harbor.verify(case, answer, output)
    assert json.loads((output / "reward.json").read_text()) == {"score": 0.0}
    assert json.loads((output / "score.json").read_text())["mark"] == "error"


def test_harbor_reward_matches_historical_scoring(tmp_path):
    saved = json.loads((harbor.APP_DIR / "evals/results/improved.json").read_text())
    case = saved["cases"][0]
    # The exported task assigns document IDs locally, independent of the full run.
    answer = case["answer"]
    ids = {entry["document_id"] for entry in answer["evidence"]}
    assert len(case["documents"]) == len(ids) == 1
    for entry in answer["evidence"]:
        entry["document_id"] = "doc1"
    case_path, answer_path = tmp_path / "case.json", tmp_path / "answer.json"
    case_path.write_text(json.dumps(case))
    answer_path.write_text(json.dumps(answer))
    output = tmp_path / "reward"
    harbor.verify(case_path, answer_path, output)
    reward = json.loads((output / "reward.json").read_text())
    assert reward["score"] == 1.0
    assert reward["answer"] == reward["evidence"] == 1.0
    assert "calculation" not in reward
    assert "uncertainty" not in reward
