"""Harbor adapter for the existing KuKi pipeline (optional Harbor dependency)."""

import os
import shlex

from harbor.agents.base import BaseAgent
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext

from kuki_ai.pipeline import PIPELINES


class KukiAgent(BaseAgent):
    @staticmethod
    def name() -> str:
        return "kuki"

    def version(self) -> str:
        return "1.0.0"

    async def setup(self, environment: BaseEnvironment) -> None:
        pass

    async def run(
        self, instruction: str, environment: BaseEnvironment, context: AgentContext
    ) -> None:
        pipeline = os.environ.get("KUKI_PIPELINE", "improved")
        if pipeline not in PIPELINES:
            raise ValueError(f"Unknown KuKi pipeline: {pipeline}")
        if not os.environ.get("OPENAI_API_KEY"):
            raise ValueError("Export OPENAI_API_KEY in the Harbor host environment")
        env = {
            name: os.environ[name]
            for name in (
                "OPENAI_API_KEY",
                "OPENAI_MODEL",
                "OPENAI_REASONING_EFFORT",
                "OPENAI_TIMEOUT_S",
                "OPENAI_MAX_RETRIES",
            )
            if name in os.environ
        }
        result = await environment.exec(
            command="python -m kuki_ai.evals.harbor answer --pipeline " + shlex.quote(pipeline),
            env=env,
            timeout_sec=1800,
        )
        if result.return_code != 0:
            raise RuntimeError(f"KuKi pipeline failed: {result.stderr}")
